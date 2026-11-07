import { Router } from 'express';
import crypto from 'node:crypto';
import { Journey } from '../models/index.js';
import { advanceOrder } from '../lib/orders.js';
import { decrypt, maskTail } from '../lib/privacy.js';
import { classifySegment } from '../engine/recommend.js';
import { evaluate } from '../kyc/validate.js';

const router = Router();

router.use((req, res, next) => {
  const given = Buffer.from(String(req.get('x-ops-token') ?? ''));
  const real = Buffer.from(String(process.env.OPS_TOKEN ?? ''));
  if (!real.length || given.length !== real.length || !crypto.timingSafeEqual(given, real)) {
    return res.status(401).json({ error: 'ops_token_required' });
  }
  next();
});

router.get('/handoffs', async (_req, res) => {
  const list = await Journey.find({ 'handoff.status': 'open' }).sort({ 'handoff.at': -1 }).limit(200).lean();
  const rows = list.map((j) => ({
    token: j.token,
    business: j.profile.businessType ?? 'Not given',
    city: j.profile.city ?? '-',
    segment: j.profile.businessType ? classifySegment(j.profile) : '-',
    employees: j.profile.employees ?? null,
    sites: j.profile.sites ?? null,
    lang: j.lang,
    reason: j.handoff.reason,
    owner: j.handoff.owner,
    score: j.handoff.score,
    at: j.handoff.at,
    stage: j.status,
    currentSetup: j.profile.currentSetup ?? null,
    issues: j.handoff.reason === 'kyc_review' ? evaluate(j.kyc ?? {}, {}).issues.filter((i) => i.severity === 'review').map(({ code, onDocument, onRegistry }) => ({ code, onDocument, onRegistry })) : [],
    phone: j.phoneEnc ? maskTail(decrypt(j.phoneEnc)) : null,
    monthly: j.bundle?.items?.length ?? 0,
  })).sort((a, b) => b.score - a.score);
  res.json({ rows });
});

router.post('/handoffs/:token/close', async (req, res) => {
  const j = await Journey.findOne({ token: req.params.token });
  if (!j?.handoff) return res.status(404).json({ error: 'not_found' });
  j.handoff = { ...j.handoff, status: 'closed', closedAt: new Date() };
  j.markModified('handoff');
  await j.save();
  res.json({ ok: true });
});

router.post('/handoffs/:token/approve-kyc', async (req, res) => {
  const j = await Journey.findOne({ token: req.params.token });
  if (j?.handoff?.reason !== 'kyc_review') return res.status(404).json({ error: 'not_found' });
  j.kyc = { ...j.kyc, reviewApproved: true };
  j.handoff = null;
  j.events.push({ name: 'kyc_approved_by_desk', at: new Date() });
  j.markModified('kyc'); j.markModified('handoff'); j.markModified('events');
  await j.save();
  res.json({ ok: true });
});

router.get('/orders', async (_req, res) => {
  const list = await Journey.find({ order: { $ne: null } }).sort({ createdAt: -1 }).limit(100).lean();
  res.json({
    rows: list.filter((j) => j.order).map((j) => ({
      id: j.order.id, business: j.order.businessName, stage: j.order.stage, eta: j.order.eta,
      items: j.order.items.map((i) => ({ name: i.name, stage: i.stage })),
    })),
  });
});

router.post('/orders/:id/advance', async (req, res) => {
  const j = await Journey.findOne({ 'order.id': req.params.id });
  if (!j) return res.status(404).json({ error: 'not_found' });
  j.order = advanceOrder(j.order);
  j.markModified('order');
  await j.save();
  res.json({ stage: j.order.stage, items: j.order.items.map((i) => ({ name: i.name, stage: i.stage })) });
});

router.get('/metrics', async (_req, res) => {
  const all = await Journey.find({}, { events: 1, status: 1, order: 1 }).limit(5000).lean();
  const count = (name) => all.filter((j) => j.events?.some((e) => e.name === name)).length;
  const started = count('started');
  const ordered = count('ordered');
  const minutes = all
    .map((j) => {
      const a = j.events?.find((e) => e.name === 'started');
      const b = j.events?.find((e) => e.name === 'ordered');
      return a && b ? (new Date(b.at) - new Date(a.at)) / 60000 : null;
    })
    .filter((x) => x != null)
    .sort((x, y) => x - y);
  res.json({
    funnel: [
      { key: 'started', n: started }, { key: 'quoted', n: count('quoted') }, { key: 'consented', n: count('consented') },
      { key: 'kyc_verified', n: count('kyc_verified') }, { key: 'ordered', n: ordered },
    ],
    medianMinutesToOrder: minutes.length ? Math.round(minutes[Math.floor(minutes.length / 2)] * 10) / 10 : null,
    trackerViews: all.reduce((s, j) => s + (j.events?.filter((e) => e.name === 'tracked').length ?? 0), 0),
  });
});

export default router;
