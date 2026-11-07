import { Router } from 'express';
import crypto from 'node:crypto';
import multer from 'multer';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { Journey, ConsentLog, RETENTION } from '../models/index.js';
import { advise, nextSlot, questionUI } from '../advisor/index.js';
import { QUESTIONS, REASONS, LOCKED, say } from '../advisor/copy.js';
import { buildQuote, toggle, addonOptions, validateBundle, classifySegment, ROUTE_TO } from '../engine/recommend.js';
import { PRODUCTS, DATA_DIR } from '../lib/catalogue.js';
import { scrub, maskTail, encrypt, decrypt, hashPhone, keyedHash } from '../lib/privacy.js';
import { sendOtpSms } from '../lib/sms.js';
import { processDocument } from '../kyc/index.js';
import { evaluate, today } from '../kyc/validate.js';
import { repairGstin, validGstin } from '../kyc/gstin.js';
import { lookupGstin, lookupUdyam } from '../kyc/registries.js';
import { propensity } from '../lib/propensity.js';
import { buildOrder, publicOrder } from '../lib/orders.js';
import { llmEnabled } from '../advisor/llm.js';

export const NOTICE_VERSION = '2026-11-v1';
const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(png|jpe?g|webp)$/.test(file.mimetype)),
});

const SPECIMEN_FILE = { gst: 'gst_certificate', udyam: 'udyam_certificate', signatory: 'signatory_id', address: 'address_proof' };
const DOC_TYPES = Object.keys(SPECIMEN_FILE);
const LANGS = ['en', 'hi', 'mr', 'bn', 'gu', 'kn', 'ml', 'pa', 'ta', 'te'];

const load = async (req, res, next) => {
  const journey = await Journey.findOne({ token: req.params.token });
  if (!journey) return res.status(404).json({ error: 'journey_not_found' });
  req.journey = journey;
  next();
};

const needsGstinNow = (items) => items.some((i) => PRODUCTS[i.id].requiresGstin);

const ADDON_REASON = { P01: 'line:prof', P02: 'line:prof', P03: 'line:prof', P04: 'line:prof', P05: 'line:mfg', P06: 'line:mfg', P07: 'mobile', P08: 'mobile', P09: 'need:failover', P12: 'need:telephony', P13: 'need:tollfree', P14: 'need:sms', P15: 'need:whatsapp', P16: 'need:email', P17: 'need:backup', P18: 'need:website', P19: 'need:payments', P20: 'need:security', P21: 'need:firewall', P22: 'need:wifi', P23: 'need:cctv', P24: 'need:machines', P25: 'need:fleet', P11: 'need:staticip', P10: 'need:central' };

function quoteView(j) {
  if (!j.bundle) return null;
  const quote = buildQuote(j.profile, j.bundle.items);
  const lang = j.lang;
  const reasonText = (key) => {
    if (key?.startsWith('dependency:')) return say(REASONS.dependency, lang);
    return say(REASONS[key], lang) || '';
  };
  return {
    ...quote,
    lines: quote.lines.map((l) => ({ ...l, why: reasonText(l.reason) })),
    addons: addonOptions(j.profile, j.bundle.items).map((a) => ({
      ...a,
      description: (ADDON_REASON[a.id] && lang !== 'en' && say(REASONS[ADDON_REASON[a.id]], lang)) || a.description,
      lockedText: a.lockedBy ? say(LOCKED[a.lockedBy], lang, { need: a.need }) : null,
    })),
    excluded: (j.bundle.excluded ?? []).map((e) => ({
      id: e.id, name: PRODUCTS[e.id].name,
      why: say(LOCKED[e.code] ?? LOCKED.dependency, lang, { need: e.need }),
      alternatives: e.alternatives.map((a) => PRODUCTS[a].name),
    })),
    notes: j.bundle.notes ?? [],
    droppedForBudget: (j.bundle.notes ?? []).filter((n) => n.startsWith('dropped_for_budget:')).map((n) => PRODUCTS[n.split(':')[1]]?.name),
  };
}

function view(j) {
  const kycResult = j.consentAt ? kycView(j) : null;
  return {
    token: j.token, lang: j.lang, status: j.status, slot: j.slot,
    ui: j.slot ? questionUI(j.slot, j.profile, j.lang) : null,
    messages: j.messages, profile: j.profile,
    quote: quoteView(j), consentAt: j.consentAt, kyc: kycResult,
    order: j.order ? publicOrder(j.order, j.lang) : null,
    handoff: j.handoff ? { reason: j.handoff.reason, text: j.handoff.text } : null,
    otp: j.otp ? { phone: j.otp.phoneMasked, verified: Boolean(j.otp.verifiedAt), expiresAt: j.otp.expiresAt } : null,
    demoMode: process.env.DEMO_MODE !== 'false',
    llm: llmEnabled(),
  };
}

function mask(field, value) {
  if (!value) return value;
  if (['gstinRaw', 'gstin'].includes(field)) return maskTail(value, 4);
  if (['idNumber', 'udyamNumber', 'udyam'].includes(field)) return maskTail(value, 4);
  return value;
}

function kycView(j) {
  const kyc = j.kyc ?? {};
  const needsGstin = j.bundle ? needsGstinNow(j.bundle.items) : false;
  const result = evaluate(kyc, { needsGstin });
  const docs = Object.fromEntries(
    Object.entries(kyc.docs ?? {}).map(([t, d]) => [t, {
      quality: d.quality, deskewed: d.deskewed, wrongType: d.wrongType, confidence: d.confidence,
      fields: Object.fromEntries(Object.entries(d.fields ?? {}).filter(([k]) => !k.startsWith('gstinRe')).map(([k, v]) => [k, mask(k, v)])),
    }]),
  );
  const verified = Object.fromEntries(Object.entries(result.verified).map(([k, v]) => [k, mask(k, v)]));
  return {
    verdict: result.verdict, issues: result.issues.map((i) => (i.suggestion ? { ...i, suggestion: maskTail(i.suggestion) } : i)),
    verified, docs, declaredNoGstin: !!kyc.declaredNoGstin, declaredNoUdyam: !!kyc.declaredNoUdyam,
    requireGstin: needsGstin,
  };
}

const logEvent = (j, name) => { j.events.push({ name, at: new Date() }); j.markModified('events'); };

async function raiseHandoff(j, reason, text) {
  if (j.handoff && j.handoff.reason === reason) return;
  const segment = classifySegment(j.profile);
  const owner = reason === 'beyond_smb_size' ? 'enterprise' : reason === 'kyc_review' ? 'kyc_desk' : ROUTE_TO[segment];
  j.handoff = {
    reason, text, owner, at: new Date(), status: 'open',
    score: propensity({ segment, source: j.source, gstin: j.profile.gstin, udyam: !!j.kyc?.declaredUdyam, cityTier: j.profile.cityTier, lang: j.lang, employees: j.profile.employees }),
  };
  j.markModified('handoff');
  logEvent(j, `handoff:${reason}`);
}

router.post('/journeys', async (req, res) => {
  const lang = LANGS.includes(req.body.lang) ? req.body.lang : 'en';
  const source = typeof req.body.source === 'string' ? req.body.source.slice(0, 40) : 'Website form';
  const j = new Journey({ token: crypto.randomBytes(24).toString('base64url'), lang, source });
  j.slot = nextSlot(j.profile);
  j.messages = [{ from: 'advisor', text: say(QUESTIONS[j.slot], lang) }];
  logEvent(j, 'started');
  await j.save();
  res.status(201).json(view(j));
});

router.get('/journeys/:token', load, (req, res) => res.json(view(req.journey)));

router.post('/journeys/:token/lang', load, async (req, res) => {
  const j = req.journey;
  if (!LANGS.includes(req.body.lang)) return res.status(400).json({ error: 'unknown_language' });
  if (j.lang !== req.body.lang) {
    j.lang = req.body.lang;
    if (j.slot) { j.messages.push({ from: 'advisor', text: say(QUESTIONS[j.slot], j.lang) }); j.markModified('messages'); }
    await j.save();
  }
  res.json(view(j));
});

router.post('/journeys/:token/message', load, async (req, res) => {
  const j = req.journey;
  const { text, value, label } = req.body;

  if (typeof text !== 'string' && value === undefined) return res.status(400).json({ error: 'empty_message' });
  const shown = scrub(label ?? text ?? String(value));
  j.messages.push({ from: 'owner', text: shown.slice(0, 800) });

  const out = await advise({ message: scrub(text ?? ''), value, label: scrub(label ?? ''), slot: value !== undefined ? j.slot : undefined, profile: j.profile, lang: j.lang });
  j.profile = out.profile;
  j.markModified('profile');
  j.slot = out.slot;
  j.messages.push({ from: 'advisor', text: out.reply, source: out.source });
  if (out.bundle) {
    j.bundle = out.bundle;
    j.markModified('bundle');
    if (j.status === 'advising') { j.status = 'quoted'; logEvent(j, 'quoted'); }
  }
  if (out.handoffReason) {
    await raiseHandoff(j, out.handoffReason, out.handoffText ?? out.reply);
    if (!out.bundle) j.status = 'handed_off';
    if (out.handoffText) j.messages.push({ from: 'advisor', text: out.handoffText, source: 'scripted' });
  }
  j.markModified('messages');
  await j.save();
  res.json(view(j));
});

router.post('/journeys/:token/quote/item', load, async (req, res) => {
  const j = req.journey;
  if (!j.bundle) return res.status(409).json({ error: 'no_bundle_yet' });
  if (j.order) return res.status(409).json({ error: 'already_ordered' });
  const { id, on, qty } = req.body;
  const r = toggle(j.profile, j.bundle.items, id, on !== false, qty);
  if (r.error) {
    return res.status(422).json({ error: r.error.code, message: say(LOCKED[r.error.code] ?? LOCKED.dependency, j.lang, { need: r.error.need }) });
  }
  if (!r.items.length) return res.status(422).json({ error: 'empty_bundle' });
  j.bundle = { ...j.bundle, items: r.items };
  j.markModified('bundle');
  await j.save();
  const removed = r.changes?.removed?.map((x) => PRODUCTS[x].name) ?? [];
  const added = r.changes?.added?.map((x) => PRODUCTS[x].name) ?? [];
  res.json({ ...view(j), change: { removed, added } });
});

router.post('/journeys/:token/consent', load, async (req, res) => {
  const j = req.journey;
  if (req.body.verification !== true) return res.status(400).json({ error: 'verification_consent_required' });
  const purposes = { verification: true, service_updates: req.body.updates === true, marketing: req.body.marketing === true };
  await ConsentLog.create({ journeyToken: j.token, noticeVersion: NOTICE_VERSION, lang: j.lang, action: 'given', purposes });
  j.consentAt = new Date();
  j.status = 'kyc';
  if (j.profile.gstin === 'no') { j.kyc = { ...j.kyc, declaredNoGstin: true }; j.markModified('kyc'); }
  logEvent(j, 'consented');
  await j.save();
  res.json(view(j));
});

router.post('/journeys/:token/consent/withdraw', load, async (req, res) => {
  const j = req.journey;
  await ConsentLog.create({ journeyToken: j.token, noticeVersion: NOTICE_VERSION, lang: j.lang, action: 'withdrawn', purposes: {} });
  j.kyc = {};
  j.consentAt = null;
  j.status = 'quoted';
  j.markModified('kyc');
  await j.save();
  res.json(view(j));
});

const needConsent = (req, res, next) => (req.journey.consentAt ? next() : res.status(403).json({ error: 'consent_required' }));

async function afterKycChange(j) {
  j.markModified('kyc');
  const r = evaluate(j.kyc, { needsGstin: needsGstinNow(j.bundle?.items ?? []) });
  if (r.verdict === 'review') await raiseHandoff(j, 'kyc_review', '');
  if (r.verdict === 'blocked') await raiseHandoff(j, 'kyc_blocked', '');
  if (r.verdict === 'verified' && ['kyc_review', 'kyc_blocked'].includes(j.handoff?.reason)) {
    j.handoff = null;
    j.markModified('handoff');
  }
  if (r.verdict === 'verified' && !j.events.some((e) => e.name === 'kyc_verified')) logEvent(j, 'kyc_verified');
  await j.save();
}

router.post('/journeys/:token/kyc/lookup', load, needConsent, async (req, res) => {
  const j = req.journey;
  const kyc = { ...j.kyc };
  if (req.body.gstin !== undefined) {
    const { value } = repairGstin(req.body.gstin);
    if (!validGstin(value)) return res.status(422).json({ error: 'gstin_invalid' });
    kyc.gstinEntered = value;
    kyc.declaredNoGstin = false;
    if (!lookupGstin(value)) kyc.gstinEntered = value;
  }
  if (req.body.udyam !== undefined) {
    const value = String(req.body.udyam).toUpperCase().replace(/\s/g, '');
    if (!/^UDYAM-[A-Z]{2}-00-\d{7}$/.test(value)) return res.status(422).json({ error: 'udyam_invalid' });
    kyc.udyamEntered = value;
    kyc.declaredUdyam = Boolean(lookupUdyam(value));
    kyc.declaredNoUdyam = false;
  }
  j.kyc = kyc;
  await afterKycChange(j);
  res.json(view(j));
});

router.post('/journeys/:token/kyc/declare', load, needConsent, async (req, res) => {
  const j = req.journey;
  j.kyc = { ...j.kyc };
  if (req.body.noGstin === true) { j.kyc.declaredNoGstin = true; delete j.kyc.gstinEntered; }
  if (req.body.noUdyam === true) { j.kyc.declaredNoUdyam = true; delete j.kyc.udyamEntered; }
  if (req.body.useSuggestedUdyam === true) {
    const hit = evaluate(j.kyc, {}).issues.find((i) => i.code === 'udyam_missing')?.suggestion;
    if (hit) { j.kyc.udyamEntered = hit; j.kyc.declaredUdyam = true; }
  }
  if (req.body.continueWithoutGst === true) {
    const r = evaluate(j.kyc, { needsGstin: needsGstinNow(j.bundle?.items ?? []) });
    if (!r.issues.some((i) => i.code === 'gstin_not_active')) return res.status(409).json({ error: 'not_allowed' });
    j.profile = { ...j.profile, gstin: 'no' };
    j.markModified('profile');
    j.bundle = { ...j.bundle, items: j.bundle.items.filter((i) => !PRODUCTS[i.id].requiresGstin) };
    j.markModified('bundle');
    j.kyc.declaredNoGstin = true;
    delete j.kyc.gstinEntered;
    if (j.kyc.docs) { const { gst, ...rest } = j.kyc.docs; j.kyc.docs = rest; }
  }
  await afterKycChange(j);
  res.json(view(j));
});

async function storeDocument(j, type, buffer) {
  const d = await processDocument(type, buffer);
  j.kyc = { ...j.kyc, reviewApproved: false, docs: { ...(j.kyc?.docs ?? {}), [type]: d } };
  await afterKycChange(j);
}

router.post('/journeys/:token/kyc/documents/:type', load, needConsent, upload.single('file'), async (req, res) => {
  if (!DOC_TYPES.includes(req.params.type)) return res.status(400).json({ error: 'unknown_document_type' });
  if (!req.file) return res.status(400).json({ error: 'photo_required' });
  await storeDocument(req.journey, req.params.type, req.file.buffer);
  res.json(view(req.journey));
});

router.post('/journeys/:token/kyc/specimen', load, needConsent, async (req, res) => {
  if (process.env.DEMO_MODE === 'false') return res.status(404).json({ error: 'not_found' });
  const { applicant } = req.body;
  if (!/^K(0[1-9]|1[0-2])$/.test(applicant ?? '')) return res.status(400).json({ error: 'unknown_applicant' });
  const j = req.journey;
  j.kyc = {};
  for (const [type, name] of Object.entries(SPECIMEN_FILE)) {
    const file = path.join(DATA_DIR, 'kyc_documents', `${applicant}_${name}.png`);
    if (existsSync(file)) {
      const d = await processDocument(type, readFileSync(file));
      j.kyc = { ...j.kyc, docs: { ...(j.kyc.docs ?? {}), [type]: d } };
    }
  }
  await afterKycChange(j);
  res.json(view(j));
});

const OTP_MINUTES = 5;
const OTP_MAX_TRIES = 5;
const otpHash = (j, code) => keyedHash(`${j.token}:${code}`);

router.post('/journeys/:token/otp/send', load, needConsent, async (req, res) => {
  const j = req.journey;
  const phone = String(req.body.phone ?? (j.otp?.phoneEnc ? decrypt(j.otp.phoneEnc) : ''));
  if (!/^[6-9]\d{9}$/.test(phone)) return res.status(422).json({ error: 'phone_invalid' });
  const wait = Number(process.env.OTP_RESEND_SECONDS ?? 30) * 1000;
  if (j.otp?.sentAt && Date.now() - new Date(j.otp.sentAt) < wait) return res.status(429).json({ error: 'otp_wait' });

  const code = String(crypto.randomInt(100000, 1000000));
  let delivered = false;
  try {
    ({ delivered } = await sendOtpSms({ phone, code, lang: j.lang }));
  } catch (err) {
    console.error(scrub(err.message));
    return res.status(503).json({ error: 'sms_unavailable' });
  }
  const demo = process.env.DEMO_MODE !== 'false';
  if (!delivered && !demo) return res.status(503).json({ error: 'sms_unavailable' });
  j.otp = {
    hash: otpHash(j, code), tries: 0, sentAt: new Date(), expiresAt: new Date(Date.now() + OTP_MINUTES * 60000),
    phoneEnc: encrypt(phone), phoneHash: hashPhone(phone), phoneMasked: maskTail(phone),
  };
  j.markModified('otp');
  await j.save();
  res.json({ ...view(j), demoCode: !delivered && demo ? code : undefined });
});

router.post('/journeys/:token/otp/verify', load, needConsent, async (req, res) => {
  const j = req.journey;
  if (j.otp?.verifiedAt) return res.json(view(j));
  if (!j.otp?.hash) return res.status(409).json({ error: 'otp_required' });
  if (new Date(j.otp.expiresAt) < new Date()) return res.status(410).json({ error: 'otp_expired' });
  if (j.otp.tries >= OTP_MAX_TRIES) return res.status(429).json({ error: 'otp_too_many' });
  const given = Buffer.from(otpHash(j, String(req.body.code ?? '')));
  const real = Buffer.from(j.otp.hash);
  if (!crypto.timingSafeEqual(given, real)) {
    j.otp = { ...j.otp, tries: j.otp.tries + 1 };
    j.markModified('otp');
    await j.save();
    return res.status(j.otp.tries >= OTP_MAX_TRIES ? 429 : 422).json({ error: j.otp.tries >= OTP_MAX_TRIES ? 'otp_too_many' : 'otp_invalid' });
  }
  const { hash, tries, ...rest } = j.otp;
  j.otp = { ...rest, verifiedAt: new Date() };
  j.markModified('otp');
  logEvent(j, 'otp_verified');
  await j.save();
  res.json(view(j));
});

router.post('/journeys/:token/order', load, async (req, res) => {
  const j = req.journey;
  if (j.order) return res.json(view(j));
  if (!j.bundle) return res.status(409).json({ error: 'no_bundle_yet' });
  if (!j.consentAt) return res.status(403).json({ error: 'consent_required' });
  const { slot, pay } = req.body;
  if (!j.otp?.verifiedAt) return res.status(403).json({ error: 'otp_required' });
  if (pay === 'fail') return res.status(402).json({ error: 'payment_failed' });

  const verdict = evaluate(j.kyc, { needsGstin: needsGstinNow(j.bundle.items) });
  if (verdict.verdict !== 'verified') return res.status(409).json({ error: 'kyc_not_verified', verdict: verdict.verdict });
  const effective = { ...j.profile, gstin: verdict.verified.gstStatus === 'Active' ? 'yes' : 'no' };
  const errors = validateBundle(effective, j.bundle.items);
  if (errors.length) return res.status(409).json({ error: 'bundle_not_eligible', details: errors });

  j.phoneEnc = j.otp.phoneEnc;
  j.phoneHash = j.otp.phoneHash;
  j.otp = { phoneMasked: j.otp.phoneMasked, verifiedAt: j.otp.verifiedAt };
  j.markModified('otp');
  j.order = buildOrder({ quote: buildQuote(effective, j.bundle.items), slot, verified: verdict.verified, now: new Date() });
  j.status = 'ordered';
  j.kyc = { verified: verdict.verified, verifiedAt: new Date(), docs: undefined };
  j.purgeAt = new Date(Date.now() + RETENTION.kycAfterOrderDays * 86400000);
  j.markModified('kyc'); j.markModified('order');
  logEvent(j, 'ordered');
  await j.save();
  res.status(201).json(view(j));
});

router.get('/track', async (req, res) => {
  const { orderId, phone } = req.query;
  if (!orderId || !phone) return res.status(400).json({ error: 'order_and_phone_required' });
  const j = await Journey.findOne({ 'order.id': String(orderId).toUpperCase().trim(), phoneHash: hashPhone(phone) });
  if (!j) return res.status(404).json({ error: 'order_not_found' });
  logEvent(j, 'tracked');
  await j.save();
  const lang = LANGS.includes(req.query.lang) ? req.query.lang : j.lang;
  res.json({ order: publicOrder(j.order, lang), token: j.token, lang });
});

router.post('/journeys/:token/callback', load, async (req, res) => {
  await raiseHandoff(req.journey, 'asked_for_person', '');
  await req.journey.save();
  res.json(view(req.journey));
});

export { today };
export default router;
