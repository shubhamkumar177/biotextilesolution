import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

const REGION = process.env.AWS_REGION || 'eu-west-1';
const SECRET_ID = process.env.APP_SECRET_ID || 'biotextile/prod';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Credentials come from the default AWS chain (EC2 instance role in production,
// ~/.aws profile locally). Nothing sensitive is read from env files.
async function fetchSecrets(attempts = 4) {
  const client = new SecretsManagerClient({ region: REGION });
  for (let attempt = 1; ; attempt++) {
    try {
      const out = await client.send(new GetSecretValueCommand({ SecretId: SECRET_ID }));
      return JSON.parse(out.SecretString || '{}');
    } catch (err) {
      if (attempt >= attempts) throw err;
      console.warn(`[config] secrets fetch failed (attempt ${attempt}): ${err.name}`);
      await sleep(1000 * 2 ** attempt);
    }
  }
}

export async function loadConfig() {
  const isProd = process.env.NODE_ENV === 'production';
  let secrets = {};

  if (process.env.SKIP_SECRETS === 'true') {
    console.warn('[config] SKIP_SECRETS=true — running without AWS Secrets Manager');
  } else {
    try {
      secrets = await fetchSecrets(isProd ? 4 : 1);
      console.log(`[config] loaded secret "${SECRET_ID}" from ${REGION}`);
    } catch (err) {
      // Keep the landing page up; lead capture still writes to disk.
      console.error(`[config] could not load secret "${SECRET_ID}": ${err.name} ${err.message}`);
    }
  }

  return {
    isProd,
    port: Number(process.env.PORT) || 3000,
    region: REGION,
    siteUrl: (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
    dataDir: process.env.DATA_DIR || new URL('../data', import.meta.url).pathname,
    admin: {
      user: secrets.ADMIN_USER || '',
      password: secrets.ADMIN_PASSWORD || '',
    },
    smtp: {
      host: secrets.SMTP_HOST || '',
      port: Number(secrets.SMTP_PORT) || 587,
      user: secrets.SMTP_USER || '',
      pass: secrets.SMTP_PASS || '',
      ehloName: secrets.SMTP_EHLO_NAME || '',
    },
    mail: {
      from: secrets.LEAD_NOTIFY_FROM || '',
      to: (secrets.LEAD_NOTIFY_TO || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    },
  };
}
