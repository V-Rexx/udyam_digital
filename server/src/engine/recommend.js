import { PRODUCTS, CITIES } from '../lib/catalogue.js';

const has = (s, re) => re.test(s);

export function classifySegment({ businessType = '', employees, sites }) {
  const t = businessType.toLowerCase();
  const isChain = has(t, /chain|group|outlets|branches|चेन|शाखा|शाखां/);
  if (isChain || (sites ?? 1) >= 3) return 'multi';
  if (has(t, /unit|manufactur|factory|workshop|printing|press|moulding|mill|plant|कारखान|फैक्ट्री|उत्पादन|कार्यशाळा/)) return 'mfg';
  if (has(t, /clinic|dental|dentist|doctor|lab|diagnostic|physio|real estate|law|lawyer|legal|advocate|coaching|tuition|ca firm|chartered|account|architect|travel|insurance|consult|office|hospital|क्लिनिक|दवाखाना|डॉक्टर|वकील|कोचिंग|ऑफिस|कार्यालय|बीमा|ट्रैवल|लैब/)) return 'prof';
  if (has(t, /shop|store|kirana|bakery|salon|parlour|parlor|pharmacy|chemist|medical|boutique|optician|stationery|hardware|sweet|mobile repair|retail|cafe|दुकान|किराना|बेकरी|सैलून|फार्मेसी|मेडिकल|बुटीक|मिठाई|केमिस्ट|किराणा|दुकान/)) return 'micro';
  return (employees ?? 1) <= 6 ? 'micro' : 'prof';
}

export function eligibility(product, profile) {
  const p = typeof product === 'string' ? PRODUCTS[product] : product;
  const tier = profile.cityTier;
  if (tier != null && !p.tiers.includes(tier)) return { ok: false, code: 'tier' };
  if ((profile.employees ?? 1) < p.minEmployees) return { ok: false, code: 'employees', need: p.minEmployees };
  if ((profile.sites ?? 1) < p.minSites) return { ok: false, code: 'sites', need: p.minSites };
  if (p.requiresGstin && profile.gstin !== 'yes') return { ok: false, code: 'gstin' };
  return { ok: true };
}

export function unitPrice(product, segment) {
  const p = typeof product === 'string' ? PRODUCTS[product] : product;
  if (segment === 'micro') return p.priceMin;
  return Math.round((p.priceMin + p.priceMax) / 2);
}

const CONNECTIVITY = ['P01', 'P02', 'P03', 'P04', 'P05', 'P06'];

function chooseConnectivity(profile, segment) {
  const can = (id) => eligibility(id, profile).ok && !(profile.excluded ?? []).includes(id);
  if (profile.fibre === 'no') return can('P04') ? 'P04' : null;
  const order = {
    micro: ['P01', 'P04'],
    prof: (profile.employees ?? 1) >= 5 ? ['P02', 'P01', 'P04'] : ['P01', 'P04'],
    multi: ['P02', 'P01', 'P04'],
    mfg: profile.needs?.includes('dedicated') && (profile.employees ?? 1) >= 25
      ? ['P06', 'P05', 'P03', 'P02', 'P01']
      : ['P05', 'P03', 'P02', 'P01'],
  }[segment];
  return order.find(can) ?? null;
}

const NEED_TO_PRODUCT = {
  payments: 'P19', whatsapp: 'P15', sms: 'P14', website: 'P18', cctv: 'P23', email: 'P16',
  backup: 'P17', security: 'P20', firewall: 'P21', wifi: 'P22', failover: 'P09',
  telephony: 'P12', tollfree: 'P13', staticip: 'P11', central: 'P10', fleet: 'P25', machines: 'P24',
};

const DEFAULT_NEEDS = {
  micro: ['payments'],
  prof: ['email', 'security'],
  multi: ['failover', 'cctv', 'email'],
  mfg: ['machines', 'firewall', 'email', 'security'],
};

const ALTERNATIVES = {
  P03: ['P02', 'P01'], P05: ['P03', 'P02'], P06: ['P05', 'P03'], P10: ['P09'],
  P12: ['P08'], P13: ['P08'], P14: ['P18'], P15: ['P18'], P21: ['P22', 'P20'],
  P24: ['P25'], P09: ['P04'], P11: [],
};

const lineQty = (profile, segment) =>
  profile.lines ?? ({ micro: 2, prof: Math.max(2, Math.ceil((profile.employees ?? 2) / 5)), multi: Math.max(2, profile.sites ?? 1), mfg: Math.max(2, Math.ceil((profile.employees ?? 10) / 25)) })[segment];

export function defaultQty(id, profile, segment) {
  const sites = profile.sites ?? 1;
  const emp = profile.employees ?? 1;
  const u = PRODUCTS[id].unit;
  if (id === 'P07' || id === 'P08') return lineQty(profile, segment);
  if (id === 'P16') return profile.users ?? Math.min(emp, segment === 'multi' ? sites * 3 : 20);
  if (id === 'P20') return profile.devices ?? Math.min(emp, segment === 'multi' ? sites * 3 : 20);
  if (id === 'P23') return profile.cameras ?? sites * 2;
  if (id === 'P19') return profile.counters ?? sites;
  if (id === 'P25') return profile.vehicles ?? 3;
  if (id === 'P24') return profile.machines ?? 5;
  if (id === 'P12') return Math.max(2, Math.min(emp, 4));
  return u === 'per site' ? sites : 1;
}

const mainLineIn = (ids) => CONNECTIVITY.find((c) => ids.includes(c));

function satisfyDependency(id, profile, segment, items) {
  const p = PRODUCTS[id];
  if (!p.requiresOneOf.length) return { ok: true };
  if (p.requiresOneOf.some((d) => items.has(d))) return { ok: true };
  const usable = p.requiresOneOf
    .filter((d) => eligibility(d, profile).ok && !(profile.excluded ?? []).includes(d))
    .filter((d) => !(profile.fibre === 'no' && d !== 'P04'))
    .sort((a, b) => unitPrice(a, segment) - unitPrice(b, segment));
  if (!usable.length) return { ok: false };
  if (profile.keepInternet) return { ok: false };
  const preferred = chooseConnectivity(profile, segment);
  const dep = usable.includes(preferred) ? preferred : usable[0];
  items.set(dep, { qty: defaultQty(dep, profile, segment), reason: `dependency:${id}`, role: 'core' });
  return { ok: true, added: dep };
}

const lineReason = (profile, segment) => {
  if (segment !== 'mfg' && profile.currentSetup === 'hotspot') return 'line:micro';
  if (segment !== 'mfg' && profile.currentSetup === 'mixed') return 'line:multi';
  return `line:${segment}`;
};

export function recommend(profile) {
  const segment = classifySegment(profile);
  const items = new Map();
  const excluded = [];
  const notes = [];
  const skip = new Set(profile.excluded ?? []);

  const exclude = (id, code, need) => {
    if (excluded.some((e) => e.id === id)) return;
    const alternatives = (ALTERNATIVES[id] ?? []).filter((a) => eligibility(a, profile).ok && !skip.has(a));
    excluded.push({ id, code, need, alternatives });
  };

  const tryAdd = (id, reason, role = 'addon') => {
    if (skip.has(id) || items.has(id)) return;
    const e = eligibility(id, profile);
    if (!e.ok) return exclude(id, e.code, e.need);
    const dep = satisfyDependency(id, profile, segment, items);
    if (!dep.ok) return exclude(id, 'dependency');
    items.set(id, { qty: defaultQty(id, profile, segment), reason, role });
  };

  const needs = profile.needs?.filter((n) => n !== 'unsure') ?? [];
  const requested = profile.requested ?? [];
  const mobileOnly = profile.mobileOnly === true;

  if (!mobileOnly && !profile.keepInternet) {
    const requestedLine = requested.find((r) => CONNECTIVITY.includes(r) && eligibility(r, profile).ok);
    const line = requestedLine ?? chooseConnectivity(profile, segment);
    if (line && !skip.has(line)) items.set(line, { qty: defaultQty(line, profile, segment), reason: lineReason(profile, segment), role: 'core' });
    if (!line) notes.push('no_connectivity');
  }

  if (!requested.some((r) => r === 'P07' || r === 'P08')) {
    tryAdd(segment === 'micro' ? 'P07' : 'P08', 'mobile', mobileOnly ? 'core' : 'addon');
  }

  for (const r of requested) tryAdd(r, 'requested', 'core');

  if (!mobileOnly) {
    const wanted = needs.length ? needs : DEFAULT_NEEDS[segment];
    for (const n of wanted) if (NEED_TO_PRODUCT[n]) tryAdd(NEED_TO_PRODUCT[n], `need:${n}`);
  }

  for (const id of skip) items.delete(id);
  for (const [id] of [...items]) {
    const p = PRODUCTS[id];
    if (p.requiresOneOf.length && !p.requiresOneOf.some((d) => items.has(d))) {
      items.delete(id);
      exclude(id, 'dependency');
    }
  }

  if (profile.budget) {
    const total = () => [...items].reduce((s, [id, v]) => s + unitPrice(id, segment) * v.qty, 0);
    const addons = [...items].filter(([, v]) => v.role === 'addon').map(([id]) => id).reverse();
    for (const id of addons) {
      if (total() <= profile.budget) break;
      items.delete(id);
      notes.push(`dropped_for_budget:${id}`);
    }
    if (total() > profile.budget) notes.push('over_budget');
  }

  return {
    segment,
    items: [...items].map(([id, v]) => ({ id, ...v })),
    excluded,
    notes,
    handoff: handoffReason(profile, segment, [...items.keys()]),
  };
}

export function handoffReason(profile, segment, ids = []) {
  if (profile.humanRequested) return 'asked_for_person';
  if (profile.city && profile.cityTier == null) return 'city_not_served';
  if ((profile.sites ?? 1) > 12 || (profile.employees ?? 1) > 150) return 'beyond_smb_size';
  if (ids.includes('P06')) return 'leased_line_survey';
  return null;
}

export const ROUTE_TO = { micro: 'partner', prof: 'inside_sales', multi: 'field_sales', mfg: 'field_sales' };

export const GST_RATE = 0.18;

export function buildQuote(profile, items) {
  const segment = classifySegment(profile);
  const lines = items.map((it) => {
    const p = PRODUCTS[it.id];
    const unit = unitPrice(p, segment);
    return {
      id: it.id, name: p.name, unitLabel: p.unit, qty: it.qty, unitPrice: unit,
      monthly: unit * it.qty, setup: p.setup * it.qty, contract: p.minContract,
      installDays: p.installDays, reason: it.reason, role: it.role,
    };
  });
  const monthly = lines.reduce((s, l) => s + l.monthly, 0);
  const setup = lines.reduce((s, l) => s + l.setup, 0);
  const gst = Math.round(monthly * GST_RATE);
  return {
    segment, lines, monthly, gst, monthlyWithGst: monthly + gst, setup,
    contractMonths: lines.length ? Math.max(...lines.map((l) => l.contract)) : 0,
    installDays: lines.length ? Math.max(...lines.map((l) => l.installDays)) : 0,
  };
}

export function validateBundle(profile, items) {
  const ids = items.map((i) => i.id);
  const errors = [];
  for (const it of items) {
    const p = PRODUCTS[it.id];
    if (!p) { errors.push({ id: it.id, code: 'unknown_product' }); continue; }
    const e = eligibility(p, profile);
    if (!e.ok) errors.push({ id: it.id, code: e.code });
    if (p.requiresOneOf.length && !p.requiresOneOf.some((d) => ids.includes(d))) errors.push({ id: it.id, code: 'dependency' });
    if (!Number.isInteger(it.qty) || it.qty < 1) errors.push({ id: it.id, code: 'quantity' });
  }
  return errors;
}

export function toggle(profile, items, id, on, qty) {
  const segment = classifySegment(profile);
  const p = PRODUCTS[id];
  if (!p) return { items, error: { code: 'unknown_product' } };
  const map = new Map(items.map((i) => [i.id, { ...i }]));
  const changes = { added: [], removed: [] };

  if (on) {
    const e = eligibility(p, profile);
    if (!e.ok) return { items, error: { code: e.code, need: e.need, id } };
    if (!map.has(id)) {
      const dep = satisfyDependency(id, { ...profile, keepInternet: false }, segment, map);
      if (!dep.ok) return { items, error: { code: 'dependency', id } };
      if (dep.added) changes.added.push(dep.added);
    }
    const q = qty ?? map.get(id)?.qty ?? defaultQty(id, profile, segment);
    map.set(id, { id, qty: Math.max(1, Math.min(500, Math.round(q))), reason: map.get(id)?.reason ?? 'added_by_owner', role: map.get(id)?.role ?? 'addon' });
  } else {
    map.delete(id);
    for (const [other] of [...map]) {
      const dep = PRODUCTS[other].requiresOneOf;
      if (dep.length && !dep.some((d) => map.has(d))) { map.delete(other); changes.removed.push(other); }
    }
  }
  return { items: [...map].map(([key, v]) => ({ ...v, id: key })), changes };
}

export function addonOptions(profile, items) {
  const segment = classifySegment(profile);
  const inBundle = new Set(items.map((i) => i.id));
  const mainLine = mainLineIn([...inBundle]);
  return Object.values(PRODUCTS)
    .filter((p) => !inBundle.has(p.id) && p.segments.includes(segment))
    .filter((p) => !(CONNECTIVITY.includes(p.id) && mainLine))
    .map((p) => {
      const e = eligibility(p, profile);
      const depOk = !p.requiresOneOf.length || p.requiresOneOf.some((d) => inBundle.has(d) || eligibility(d, profile).ok);
      return {
        id: p.id, name: p.name, description: p.description, unit: p.unit,
        unitPrice: unitPrice(p, segment), setup: p.setup, qty: defaultQty(p.id, profile, segment),
        available: e.ok && depOk, lockedBy: e.ok ? (depOk ? null : 'dependency') : e.code, need: e.need ?? null,
      };
    });
}

export const cityInfo = (name) => {
  if (!name) return null;
  const key = Object.keys(CITIES).find((c) => c.toLowerCase() === String(name).trim().toLowerCase());
  return key ? { city: key, ...CITIES[key] } : null;
};
