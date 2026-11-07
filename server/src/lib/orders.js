import crypto from 'node:crypto';
import { LOCALES } from '../advisor/locales.js';

const DAY = 86400000;
export const STAGES = ['placed', 'scheduled', 'on_the_way', 'installing', 'active'];

export const stageLabel = {
  placed: { en: 'Order placed', hi: 'ऑर्डर हो गया', mr: 'ऑर्डर झाला' },
  scheduled: { en: 'Scheduled', hi: 'तय हो गया', mr: 'ठरले' },
  on_the_way: { en: 'On the way', hi: 'रास्ते में', mr: 'मार्गावर' },
  installing: { en: 'Being set up', hi: 'सेटअप हो रहा है', mr: 'सेटअप होत आहे' },
  active: { en: 'Working', hi: 'चालू है', mr: 'सुरू आहे' },
};

for (const [lang, L] of Object.entries(LOCALES)) for (const k of STAGES) stageLabel[k][lang] = L.stages[k];

export function buildOrder({ quote, slot, verified, now }) {
  const placedAt = new Date(now);
  const items = quote.lines.map((l) => ({
    id: l.id, name: l.name, qty: l.qty, installDays: l.installDays,
    stage: 'scheduled',
    eta: new Date(placedAt.getTime() + l.installDays * DAY),
  }));
  const eta = new Date(Math.max(...items.map((i) => i.eta.getTime())));
  return {
    id: `UD-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    placedAt, eta, slot: slot ?? null, items, stage: 'scheduled',
    monthly: quote.monthly, gst: quote.gst, monthlyWithGst: quote.monthlyWithGst, setup: quote.setup,
    contractMonths: quote.contractMonths, segment: quote.segment,
    businessName: verified.tradeName ?? null,
    history: [{ stage: 'placed', at: placedAt }, { stage: 'scheduled', at: placedAt }],
  };
}

export function advanceOrder(order, now = new Date()) {
  const open = order.items.filter((i) => i.stage !== 'active').sort((a, b) => a.installDays - b.installDays);
  if (!open.length) return order;
  const next = open[0];
  next.stage = STAGES[STAGES.indexOf(next.stage) + 1];
  if (next.stage === 'active') next.activatedAt = now;
  const first = open.length > 0 ? order.items.map((i) => STAGES.indexOf(i.stage)) : [];
  order.stage = STAGES[Math.min(...first)];
  order.history.push({ stage: next.stage, item: next.name, at: now });
  return order;
}

export function publicOrder(o, lang = 'en') {
  const label = (s) => stageLabel[s]?.[lang] ?? stageLabel[s]?.en ?? s;
  return {
    id: o.id, placedAt: o.placedAt, eta: o.eta, slot: o.slot, stage: o.stage, stageLabel: label(o.stage),
    stages: STAGES.map((s) => ({ key: s, label: label(s), done: STAGES.indexOf(s) <= STAGES.indexOf(o.stage) })),
    items: o.items.map((i) => ({ id: i.id, name: i.name, qty: i.qty, stage: i.stage, stageLabel: label(i.stage), eta: i.eta, activatedAt: i.activatedAt ?? null })),
    monthly: o.monthly, gst: o.gst, monthlyWithGst: o.monthlyWithGst, setup: o.setup, contractMonths: o.contractMonths,
    businessName: o.businessName,
    history: o.history.map((h) => ({ ...h, label: label(h.stage) })),
  };
}
