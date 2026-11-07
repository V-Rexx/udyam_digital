import test from 'node:test';
import assert from 'node:assert/strict';
import { readCsv, PRODUCTS } from '../src/lib/catalogue.js';
import { recommend, validateBundle, buildQuote, toggle, classifySegment, eligibility, unitPrice, addonOptions } from '../src/engine/recommend.js';

const ids = (r) => r.items.map((i) => i.id);
const base = { businessType: 'Dental clinic', employees: 12, sites: 1, city: 'Pune', cityTier: 1, gstin: 'yes', fibre: 'yes', needs: ['email', 'security'] };
const SEG = { 'Micro retail & services': 'micro', 'Professional offices': 'prof', 'Small multi-site businesses': 'multi', 'Small manufacturers': 'mfg' };
const leads = readCsv('smb_leads.csv');

test('all 5,000 lead profiles: every recommended bundle obeys every catalogue rule', () => {
  let bundles = 0;
  for (const l of leads) {
    const profile = { businessType: l.business_type, employees: +l.employee_count, sites: +l.num_sites, city: l.city, cityTier: +l.city_tier, gstin: l.has_gstin === 'Y' ? 'yes' : 'no', fibre: 'yes', needs: ['unsure'], requested: l.products_of_interest.split(';') };
    const r = recommend(profile);
    assert.deepEqual(validateBundle(profile, r.items), [], `${l.lead_id}: ${JSON.stringify(r.items)}`);
    bundles++;
  }
  assert.equal(bundles, 5000);
});

test('segment classifier agrees with the data', () => {
  const miss = leads.filter((l) => classifySegment({ businessType: l.business_type, employees: +l.employee_count, sites: +l.num_sites }) !== SEG[l.segment]);
  assert.equal(miss.length, 0, `${miss.length} misclassified, e.g. ${miss[0]?.business_type}`);
});

test('every price stays inside the catalogue band', () => {
  for (const p of Object.values(PRODUCTS)) for (const s of ['micro', 'prof', 'multi', 'mfg']) {
    const u = unitPrice(p, s);
    assert.ok(u >= p.priceMin && u <= p.priceMax, `${p.id} ${s} ${u}`);
  }
});

test('Biz Fibre 1G is refused in a tier 2 city, with an alternative', () => {
  const r = recommend({ ...base, city: 'Nagpur', cityTier: 2, requested: ['P03'] });
  assert.ok(!ids(r).includes('P03'));
  const e = r.excluded.find((x) => x.id === 'P03');
  assert.equal(e.code, 'tier');
  assert.ok(e.alternatives.includes('P02'));
});

test('WhatsApp API is refused without GST, and the reason is GST', () => {
  const r = recommend({ businessType: 'Kirana store', employees: 3, sites: 1, city: 'Pune', cityTier: 1, gstin: 'no', fibre: 'yes', needs: ['whatsapp'] });
  assert.ok(!ids(r).includes('P15'));
  assert.equal(r.excluded.find((x) => x.id === 'P15').code, 'gstin');
});

test('a 3-person business cannot buy a leased line', () => {
  const r = recommend({ businessType: 'Salon', employees: 3, sites: 1, city: 'Pune', cityTier: 1, gstin: 'yes', fibre: 'yes', needs: ['unsure'], requested: ['P05'] });
  assert.ok(!ids(r).includes('P05'));
  assert.equal(r.excluded.find((x) => x.id === 'P05').code, 'employees');
});

test('SD-WAN needs 3 sites and 10 people', () => {
  const two = recommend({ ...base, sites: 2, requested: ['P10'] });
  assert.equal(two.excluded.find((x) => x.id === 'P10').code, 'sites');
  const small = recommend({ businessType: 'Bakery chain', employees: 8, sites: 3, city: 'Pune', cityTier: 1, gstin: 'yes', fibre: 'yes', needs: ['central'] });
  assert.equal(small.excluded.find((x) => x.id === 'P10').code, 'employees');
});

test('CCTV pulls in a line it can run on', () => {
  const r = recommend({ businessType: 'Boutique', employees: 2, sites: 1, city: 'Patna', cityTier: 2, gstin: 'no', fibre: 'yes', needs: ['cctv'] });
  assert.ok(ids(r).includes('P23'));
  assert.ok(ids(r).some((x) => PRODUCTS.P23.requiresOneOf.includes(x)));
});

test('no fibre at the site: AirFiber, and failover (which needs a wired line) is refused', () => {
  const r = recommend({ ...base, fibre: 'no', needs: ['failover'] });
  assert.ok(ids(r).includes('P04'));
  assert.ok(!ids(r).includes('P09'));
  assert.ok(r.excluded.some((x) => x.id === 'P09'));
});

test('only a mobile plan means only a mobile plan', () => {
  const r = recommend({ businessType: 'Kirana store', employees: 2, sites: 1, city: 'Pune', cityTier: 1, gstin: 'no', fibre: 'yes', mobileOnly: true, lines: 2 });
  assert.deepEqual(ids(r), ['P07']);
  assert.equal(r.items[0].qty, 2);
  assert.equal(buildQuote({ businessType: 'Kirana store', employees: 2 }, r.items).contractMonths, 1);
});

test('budget drops add-ons, not the line, and says what it dropped', () => {
  const r = recommend({ ...base, budget: 2500, needs: ['email', 'security', 'backup', 'failover'] });
  const q = buildQuote(base, r.items);
  assert.ok(q.monthly <= 2500);
  assert.ok(ids(r).includes('P02'));
  assert.ok(r.notes.some((n) => n.startsWith('dropped_for_budget')));
});

test('a budget too small for the line is flagged, not hidden', () => {
  const r = recommend({ ...base, budget: 100 });
  assert.ok(r.notes.includes('over_budget'));
});

test('something the owner refused stays out, and the next-best line takes its place', () => {
  const r = recommend({ ...base, needs: ['failover', 'email'], excluded: ['P02'] });
  assert.ok(!ids(r).includes('P02'));
  assert.ok(ids(r).includes('P01'));
  assert.deepEqual(validateBundle(base, r.items), []);
});

test('keeping their own internet means nothing that needs an Accel line', () => {
  const r = recommend({ ...base, needs: ['failover', 'email'], keepInternet: true });
  assert.ok(!ids(r).includes('P09'));
  assert.equal(r.excluded.find((x) => x.id === 'P09').code, 'dependency');
  assert.ok(ids(r).includes('P16'));
});

test('toggling: adding CCTV to a mobile-only bundle adds a line; removing the line removes CCTV', () => {
  const profile = { businessType: 'Kirana store', employees: 2, sites: 1, city: 'Pune', cityTier: 1, gstin: 'no', fibre: 'yes' };
  const add = toggle(profile, [{ id: 'P07', qty: 2, role: 'core' }], 'P23', true);
  assert.equal(add.changes.added.length, 1);
  const line = add.changes.added[0];
  const rem = toggle(profile, add.items, line, false);
  assert.deepEqual(rem.changes.removed, ['P23']);
  assert.deepEqual(validateBundle(profile, rem.items), []);
});

test('toggling cannot add an ineligible product', () => {
  const profile = { businessType: 'Kirana store', employees: 2, sites: 1, city: 'Pune', cityTier: 1, gstin: 'no', fibre: 'yes' };
  const r = toggle(profile, [{ id: 'P01', qty: 1, role: 'core' }], 'P15', true);
  assert.equal(r.error.code, 'gstin');
});

test('quote adds up, and contract is the longest in the bundle', () => {
  const r = recommend(base);
  const q = buildQuote(base, r.items);
  assert.equal(q.monthly, q.lines.reduce((s, l) => s + l.unitPrice * l.qty, 0));
  assert.equal(q.monthlyWithGst, q.monthly + Math.round(q.monthly * 0.18));
  assert.equal(q.contractMonths, Math.max(...r.items.map((i) => PRODUCTS[i.id].minContract)));
});

test('a very large business goes to a person', () => {
  assert.equal(recommend({ ...base, sites: 40, businessType: 'Restaurant chain' }).handoff, 'beyond_smb_size');
});

test('locked add-ons say why', () => {
  const profile = { businessType: 'Kirana store', employees: 2, sites: 1, cityTier: 1, gstin: 'no', fibre: 'yes' };
  const wa = addonOptions(profile, [{ id: 'P01', qty: 1 }]).find((a) => a.id === 'P15');
  assert.equal(wa.available, false);
  assert.equal(wa.lockedBy, 'gstin');
});

test('eligibility follows the CSV for every product and a small business', () => {
  const small = { employees: 1, sites: 1, cityTier: 2, gstin: 'no' };
  const ok = Object.values(PRODUCTS).filter((p) => eligibility(p, small).ok).map((p) => p.id);
  for (const id of ok) {
    const p = PRODUCTS[id];
    assert.ok(p.tiers.includes(2) && p.minEmployees <= 1 && p.minSites <= 1 && !p.requiresGstin);
  }
});
