import fs from 'node:fs/promises';
import path from 'node:path';

export const CATEGORIES = ['Period Underwear', 'Functional Shapewear', 'Premium Lingerie', 'Other'];
export const VOLUMES = ['Under 10k pcs', '10k–50k pcs', '50k–250k pcs', '250k+ pcs'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function validateLead(body) {
  const lead = {
    name: clean(body.name, 120),
    company: clean(body.company, 160),
    email: clean(body.email, 254).toLowerCase(),
    category: clean(body.category, 60),
    volume: clean(body.volume, 30),
    message: clean(body.message, 2000),
    wantsSpecs: ['on', 'true', true, '1'].includes(body.wantsSpecs),
    consent: ['on', 'true', true, '1'].includes(body.consent),
  };

  const errors = {};
  const isOther = lead.category === 'Other';
  if (lead.name.length < 2) errors.name = 'Please enter your full name.';
  if (!lead.company) errors.company = 'Please enter your company or brand.';
  if (!EMAIL_RE.test(lead.email)) errors.email = 'Please enter a valid work email.';
  if (!CATEGORIES.includes(lead.category)) errors.category = 'Please choose a category.';
  // Volume is optional for "Other" (volume may not be known yet).
  if (isOther && !lead.volume) lead.volume = '';
  else if (!VOLUMES.includes(lead.volume)) errors.volume = 'Please choose a volume band.';
  if (!lead.consent) errors.consent = 'Please confirm we may contact you.';

  return Object.keys(errors).length ? { errors } : { lead };
}

// Append-only JSON Lines file on a Docker volume. Enquiry volume is small,
// so this keeps the monolith dependency-free; swap for a database when needed.
export function createLeadStore(dataDir) {
  const file = path.join(dataDir, 'leads.jsonl');

  return {
    async save(record) {
      await fs.mkdir(dataDir, { recursive: true });
      await fs.appendFile(file, JSON.stringify(record) + '\n', { mode: 0o600 });
    },
    // UK GDPR storage limitation: drop enquiries older than the retention period.
    async prune(maxAgeDays) {
      const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
      const records = await this.all();
      const kept = records.filter((r) => Date.parse(r.createdAt) >= cutoff);
      if (kept.length === records.length) return 0;
      const body = kept.map((r) => JSON.stringify(r) + '\n').join('');
      await fs.writeFile(file + '.tmp', body, { mode: 0o600 });
      await fs.rename(file + '.tmp', file);
      return records.length - kept.length;
    },
    async all() {
      try {
        const raw = await fs.readFile(file, 'utf8');
        return raw.split('\n').filter(Boolean).map((line) => JSON.parse(line));
      } catch (err) {
        if (err.code === 'ENOENT') return [];
        throw err;
      }
    },
  };
}

const CSV_COLUMNS = ['createdAt', 'name', 'company', 'email', 'category', 'volume', 'wantsSpecs', 'message', 'id'];

function csvCell(value) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // spreadsheet formula injection guard
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(records) {
  const rows = records.map((r) => CSV_COLUMNS.map((c) => csvCell(r[c])).join(','));
  return [CSV_COLUMNS.join(','), ...rows].join('\r\n') + '\r\n';
}
