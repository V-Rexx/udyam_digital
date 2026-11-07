import { validGstin, repairGstin, GST_STATE_CODES } from './gstin.js';
import { lookupGstin, lookupUdyam, findUdyamFor } from './registries.js';

export const today = () => new Date(process.env.KYC_TODAY && process.env.DEMO_MODE !== 'false' ? process.env.KYC_TODAY : Date.now());
export const MAX_ADDRESS_PROOF_AGE_DAYS = 90;
export const MIN_SHARPNESS = 150;

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

function closeness(a, b) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const d = Array.from({ length: x.length + 1 }, (_, i) => [i, ...Array(y.length).fill(0)]);
  for (let j = 1; j <= y.length; j++) d[0][j] = j;
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
  }
  return 1 - d[x.length][y.length] / Math.max(x.length, y.length);
}
export const sameName = (a, b) => closeness(a, b) >= 0.88;
const sameAddress = (a, b) => closeness(a, b) >= 0.9;

const daysBetween = (from, to) => Math.floor((to - new Date(from)) / 86400000);

export function evaluate(kyc, { needsGstin = true, today: now = today() } = {}) {
  const issues = [];
  const add = (code, severity, doc, params = {}) => issues.push({ code, severity, doc, ...params });
  const docs = kyc.docs ?? {};
  const noGst = kyc.declaredNoGstin === true;
  const verified = {};

  for (const [type, d] of Object.entries(docs)) {
    if (d.quality === 'blurred') add('photo_blurred', 'action', type);
    if (d.wrongType) add('wrong_document', 'action', type, { found: d.wrongType });
  }
  const usable = (t) => docs[t] && docs[t].quality !== 'blurred' && !docs[t].wrongType;

  let reg = null;
  if (!noGst) {
    const gstFromDoc = usable('gst') ? docs.gst.fields.gstinRaw : null;
    const entered = kyc.gstinEntered ?? gstFromDoc;
    if (!entered && !docs.gst) {
      add('gst_missing', 'action', 'gst');
    } else if (entered) {
      const { value } = repairGstin(entered);
      if (!validGstin(value)) {
        const unclear = !kyc.gstinEntered && docs.gst?.fields?.gstinReadsAgree === false;
        add(unclear ? 'gstin_unclear' : 'gstin_invalid', unclear ? 'action' : 'block', 'gst');
      } else {
        verified.gstin = value;
        reg = lookupGstin(value);
        if (!reg) add('gstin_not_in_registry', 'block', 'gst');
        else {
          verified.legalName = reg.legal_name;
          verified.tradeName = reg.trade_name;
          verified.constitution = reg.constitution;
          verified.address = reg.principal_place_of_business;
          verified.gstStatus = reg.status;
          if (reg.status !== 'Active') add('gstin_not_active', 'block', 'gst', { status: reg.status });
          const stateFromCode = GST_STATE_CODES[value.slice(0, 2)];
          if (stateFromCode && reg.state !== stateFromCode) add('gstin_state_mismatch', 'review', 'gst');
          if (usable('gst')) {
            const f = docs.gst.fields;
            if (f.legalName && !sameName(f.legalName, reg.legal_name)) add('legal_name_mismatch', 'review', 'gst', { onDocument: f.legalName, onRegistry: reg.legal_name });
            if (f.tradeName && !sameName(f.tradeName, reg.trade_name)) add('trade_name_mismatch', 'review', 'gst', { onDocument: f.tradeName, onRegistry: reg.trade_name });
            if (f.address && !sameAddress(f.address, reg.principal_place_of_business)) add('gst_address_mismatch', 'review', 'gst');
          }
        }
      }
    }
  } else if (needsGstin) {
    add('gstin_required_for_bundle', 'block', 'gst');
  }

  const businessName = reg?.trade_name ?? docs.udyam?.fields?.enterpriseName ?? docs.signatory?.fields?.business;

  if (!kyc.declaredNoUdyam) {
    const entered = kyc.udyamEntered ?? (usable('udyam') ? docs.udyam.fields.udyamNumber : '');
    if (entered) {
      const u = lookupUdyam(entered);
      if (!u) add('udyam_not_in_registry', 'review', 'udyam');
      else {
        verified.udyam = entered;
        verified.enterpriseType = u.enterprise_type;
        if (businessName && !sameName(u.enterprise_name, businessName)) add('udyam_name_mismatch', 'review', 'udyam', { onRegistry: u.enterprise_name });
        if (reg && u.state !== reg.state) add('udyam_state_mismatch', 'review', 'udyam');
      }
    } else if (docs.udyam && usable('udyam')) {
      add('udyam_number_unreadable', 'action', 'udyam');
    } else if (!docs.udyam) {
      const hit = findUdyamFor(businessName, reg?.principal_place_of_business?.split(',').at(-2)?.trim());
      add('udyam_missing', 'action', 'udyam', hit ? { suggestion: hit.udyam_number } : {});
    }
  }

  if (!docs.signatory) add('signatory_missing', 'action', 'signatory');
  else if (usable('signatory')) {
    const f = docs.signatory.fields;
    verified.signatoryName = f.name;
    if (!f.name || !f.idNumber) add('signatory_unreadable', 'action', 'signatory');
    if (f.validTill && new Date(f.validTill) < now) add('signatory_expired', 'action', 'signatory', { validTill: f.validTill });
    if (businessName && f.business && !sameName(f.business, businessName)) add('signatory_business_mismatch', 'review', 'signatory');
    if (reg?.constitution === 'Proprietorship' && f.name && !norm(reg.legal_name).startsWith(norm(f.name))) {
      add('signatory_not_proprietor', 'review', 'signatory');
    }
  }

  if (!docs.address) add('address_missing', 'action', 'address');
  else if (usable('address')) {
    const f = docs.address.fields;
    if (!f.billDate) add('address_unreadable', 'action', 'address');
    else {
      const age = daysBetween(f.billDate, now);
      if (age > MAX_ADDRESS_PROOF_AGE_DAYS) add('address_proof_old', 'action', 'address', { billDate: f.billDate, ageDays: age });
    }
    if (businessName && f.billedTo && !sameName(f.billedTo, businessName)) add('address_name_mismatch', 'review', 'address');
    if (reg && f.address && !sameAddress(f.address, reg.principal_place_of_business)) add('address_mismatch', 'review', 'address');
    verified.installAddress = f.address || verified.address;
  }

  if (kyc.reviewApproved) issues.splice(0, issues.length, ...issues.filter((i) => i.severity !== 'review'));

  const order = { block: 'blocked', review: 'review', action: 'action_needed' };
  const worst = ['block', 'review', 'action'].find((s) => issues.some((i) => i.severity === s));
  return { verdict: worst ? order[worst] : 'verified', issues, verified };
}
