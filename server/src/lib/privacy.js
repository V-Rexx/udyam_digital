import crypto from 'node:crypto';

const GSTIN = /\b\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]\b/gi;
const PAN = /\b[A-Z]{5}\d{4}[A-Z]\b/gi;
const UDYAM = /\bUDYAM-[A-Z]{2}-\d{2}-\d{7}\b/gi;
const AADHAAR = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;
const PHONE = /(?:\+?91[\s-]?)?\b[6-9]\d{9}\b/g;
const EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g;

export const scrub = (text) =>
  String(text ?? '')
    .replace(GSTIN, '[GSTIN]').replace(UDYAM, '[UDYAM]').replace(PAN, '[PAN]')
    .replace(AADHAAR, '[ID]').replace(PHONE, '[PHONE]').replace(EMAIL, '[EMAIL]');

export const maskTail = (s, keep = 4) => {
  const v = String(s ?? '');
  return v.length <= keep ? '*'.repeat(v.length) : '*'.repeat(Math.max(0, v.length - keep)) + v.slice(-keep);
};

const key = () => {
  const hex = process.env.DATA_KEY;
  if (hex && /^[0-9a-f]{64}$/i.test(hex)) return Buffer.from(hex, 'hex');
  if (process.env.DEMO_MODE === 'false') throw new Error('DATA_KEY must be set outside demo mode');
  return crypto.createHash('sha256').update('udyam-demo-key-not-for-real-data').digest();
};

export function encrypt(plain) {
  if (plain == null) return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}

export function decrypt(blob) {
  if (!blob) return null;
  const [iv, tag, enc] = blob.split('.').map((s) => Buffer.from(s, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}

export const keyedHash = (value) => crypto.createHmac('sha256', key()).update(String(value)).digest('hex');

export const hashPhone = (phone) =>
  crypto.createHmac('sha256', key()).update(String(phone).replace(/\D/g, '').slice(-10)).digest('hex');
