import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { loadConfig } from './config.js';
import { createLeadStore, validateLead, toCsv, CATEGORIES, VOLUMES } from './leads.js';
import { createNotifier } from './notify.js';
import { PRICING } from './pricing.js';
import { COMPANY } from './company.js';

const RETENTION_DAYS = 730; // stated in the privacy notice

const root = path.dirname(fileURLToPath(import.meta.url));
const config = await loadConfig();
const leads = createLeadStore(config.dataDir);
const notifier = createNotifier(config);

// Changes on every deploy, so static assets can be cached forever.
const assetVersion = Date.now().toString(36);

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // behind nginx
app.set('view engine', 'ejs');
app.set('views', path.join(root, '..', 'views'));

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        fontSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: config.isProd ? [] : null,
      },
    },
    strictTransportSecurity: false, // set by nginx
  }),
);
app.use(compression());

app.use(
  '/assets',
  express.static(path.join(root, '..', 'public'), {
    maxAge: config.isProd ? '365d' : 0,
    immutable: config.isProd,
  }),
);

const pageLocals = () => ({
  assetVersion,
  siteUrl: config.siteUrl,
  year: new Date().getFullYear(),
  company: COMPANY,
});

const pruneLeads = () =>
  leads
    .prune(RETENTION_DAYS)
    .then((n) => n && console.log(`[leads] pruned ${n} enquiries past retention`))
    .catch((err) => console.error('[leads] prune failed:', err.message));
pruneLeads();
setInterval(pruneLeads, 24 * 60 * 60 * 1000).unref();

app.get('/', (req, res) => {
  res.render('index', { ...pageLocals(), categories: CATEGORIES, volumes: VOLUMES, pricing: PRICING });
});

app.get('/privacy', (req, res) => {
  res.render('privacy', { ...pageLocals(), retentionDays: RETENTION_DAYS });
});

app.get('/thank-you', (req, res) => {
  res.render('message', {
    ...pageLocals(),
    title: 'Application received',
    heading: 'Thank you. Your application is in.',
    body: 'Our UK team will review your pilot objectives and be in touch within two working days.',
  });
});

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nSitemap: ${config.siteUrl}/sitemap.xml\n`);
});

app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${config.siteUrl}/</loc></url><url><loc>${config.siteUrl}/privacy</loc></url></urlset>\n`,
  );
});

const pilotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { ok: false, error: 'Too many submissions. Please try again later.' },
});

app.post(
  '/api/pilot',
  pilotLimiter,
  express.urlencoded({ extended: false, limit: '16kb' }),
  express.json({ limit: '16kb' }),
  async (req, res, next) => {
    const wantsJson = req.is('application/json') || req.accepts(['html', 'json']) === 'json';
    const body = req.body ?? {};

    // Honeypot: bots fill the hidden "website" field. Pretend success.
    if (body.website) {
      return wantsJson ? res.json({ ok: true }) : res.redirect(303, '/thank-you');
    }

    const { lead, errors } = validateLead(body);
    if (errors) {
      if (wantsJson) return res.status(422).json({ ok: false, errors });
      return res.status(422).render('message', {
        ...pageLocals(),
        title: 'Please check your details',
        heading: 'A few details need attention.',
        body: Object.values(errors).join(' '),
        backLink: '/#pilot',
      });
    }

    try {
      const record = { id: randomUUID(), createdAt: new Date().toISOString(), ...lead };
      await leads.save(record);
      notifier.leadReceived(record).catch((err) => console.error('[notify] failed:', err.name, err.message));
      return wantsJson ? res.json({ ok: true }) : res.redirect(303, '/thank-you');
    } catch (err) {
      return next(err);
    }
  },
);

function requireAdmin(req, res, next) {
  const { user, password } = config.admin;
  if (!user || !password) return res.sendStatus(404);

  const [scheme, encoded] = (req.get('authorization') || '').split(' ');
  const [u = '', p = ''] = Buffer.from(encoded || '', 'base64').toString().split(/:(.*)/s);
  const safeEq = (a, b) => {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && timingSafeEqual(ab, bb);
  };

  if (scheme === 'Basic' && safeEq(u, user) && safeEq(p, password)) return next();
  res.set('WWW-Authenticate', 'Basic realm="Bio Textile Solution UK admin", charset="UTF-8"').sendStatus(401);
}

app.get('/admin/leads.csv', requireAdmin, async (req, res, next) => {
  try {
    const csv = toCsv(await leads.all());
    res
      .set('Cache-Control', 'no-store')
      .attachment(`biotextile-pilot-applications-${new Date().toISOString().slice(0, 10)}.csv`)
      .type('text/csv')
      .send(csv);
  } catch (err) {
    next(err);
  }
});

app.use((req, res) => {
  res.status(404).render('message', {
    ...pageLocals(),
    title: 'Page not found',
    heading: 'This page has reached the end of its lifecycle.',
    body: 'The page you were looking for doesn’t exist.',
    backLink: '/',
  });
});

app.use((err, req, res, _next) => {
  console.error('[error]', err);
  const status = err.status || err.statusCode || 500;
  if (req.accepts(['html', 'json']) === 'json') return res.status(status).json({ ok: false });
  res.status(status).render('message', {
    ...pageLocals(),
    title: 'Something went wrong',
    heading: 'Something went wrong on our side.',
    body: 'Please try again in a moment.',
    backLink: '/',
  });
});

const server = app.listen(config.port, () => {
  console.log(`[server] Bio Textile Solution UK listening on :${config.port}`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`[server] ${signal} received, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
