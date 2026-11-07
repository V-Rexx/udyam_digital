import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { DATA_DIR, readCsv } from '../src/lib/catalogue.js';
import { processDocument } from '../src/kyc/index.js';
import { evaluate } from '../src/kyc/validate.js';
import { closeOcr } from '../src/kyc/ocr.js';
import { validGstin, repairGstin, checksumChar } from '../src/kyc/gstin.js';

const NAMES = { gst: 'gst_certificate', udyam: 'udyam_certificate', signatory: 'signatory_id', address: 'address_proof' };
const TODAY = new Date('2026-07-15');
const cache = {};
async function applicant(id) {
  if (cache[id]) return cache[id];
  const docs = {};
  for (const [t, n] of Object.entries(NAMES)) {
    const f = path.join(DATA_DIR, 'kyc_documents', `${id}_${n}.png`);
    if (existsSync(f)) docs[t] = await processDocument(t, readFileSync(f));
  }
  return (cache[id] = { docs });
}
const check = async (id) => evaluate(await applicant(id), { today: TODAY });
const codes = (r) => r.issues.map((i) => i.code);

test('every registry GSTIN passes our checksum', () => {
  const all = readCsv('mock_gstin_registry.csv');
  assert.equal(all.filter((r) => validGstin(r.gstin)).length, all.length);
});

test('a changed digit fails the checksum and repair cannot rescue it', () => {
  const good = '27XUIXG0767D1ZP';
  const bad = good.replace('0767', '0768');
  assert.equal(validGstin(bad), false);
  assert.equal(validGstin(repairGstin(bad).value), false);
});

test('OCR slips that keep the checksum valid are repaired', () => {
  assert.equal(repairGstin('27XUIXGO767D1ZP').value, '27XUIXG0767D1ZP');
  assert.equal(repairGstin('32TZAXB5481U171').value, '32TZAXB5481U1Z1');
  assert.equal(repairGstin('27QHIXK0658U1ZL').value, '27QHJXK0658U1ZL');
  assert.equal(checksumChar('27XUIXG0767D1Z'), 'P');
});

test('K01: cancelled GSTIN is blocked; blank Udyam number is caught', async () => {
  const r = await check('K01');
  assert.equal(r.verdict, 'blocked');
  assert.ok(codes(r).includes('gstin_not_active'));
  assert.equal(r.issues.find((i) => i.code === 'gstin_not_active').status, 'Cancelled');
  assert.ok(codes(r).includes('udyam_number_unreadable'));
});

test('K02: a tilted scan is straightened and passes', async () => {
  const a = await applicant('K02');
  assert.equal(a.docs.gst.deskewed, true);
  assert.equal((await check('K02')).verdict, 'verified');
});

test('K04: a blurred certificate asks for a retake instead of guessing', async () => {
  const r = await check('K04');
  assert.equal(r.verdict, 'action_needed');
  assert.deepEqual(codes(r), ['photo_blurred']);
});

test('K05: missing Udyam certificate is caught, and the registry offers the match', async () => {
  const r = await check('K05');
  assert.equal(r.verdict, 'action_needed');
  const i = r.issues.find((x) => x.code === 'udyam_missing');
  assert.equal(i.suggestion, 'UDYAM-KL-00-5521886');
});

test('K06: GSTIN that fails the checksum on repeated reads is blocked', async () => {
  const r = await check('K06');
  assert.equal(r.verdict, 'blocked');
  assert.ok(codes(r).includes('gstin_invalid'));
});

test('K07: legal name on the certificate differs from the registry', async () => {
  const r = await check('K07');
  assert.equal(r.verdict, 'review');
  assert.ok(codes(r).includes('legal_name_mismatch'));
});

test('K11: electricity bill older than 90 days is refused', async () => {
  const r = await check('K11');
  assert.equal(r.verdict, 'action_needed');
  assert.ok(codes(r).includes('address_proof_old'));
});

for (const id of ['K03', 'K08', 'K09', 'K10', 'K12']) {
  test(`${id}: a clean applicant passes with no false alarms`, async () => {
    const r = await check(id);
    assert.deepEqual(r.issues, []);
    assert.equal(r.verdict, 'verified');
  });
}

test('all signatory IDs and address proofs yield their key fields', async () => {
  for (let k = 1; k <= 12; k++) {
    const a = await applicant(`K${String(k).padStart(2, '0')}`);
    assert.ok(a.docs.signatory.fields.name && a.docs.signatory.fields.idNumber && a.docs.signatory.fields.validTill, `K${k} signatory`);
    assert.ok(a.docs.address.fields.billDate && a.docs.address.fields.billedTo, `K${k} address`);
  }
});

test('wrong document in the wrong slot is caught', async () => {
  const d = await processDocument('gst', readFileSync(path.join(DATA_DIR, 'kyc_documents', 'K03_address_proof.png')));
  assert.equal(d.wrongType, 'address');
});

test('rules: expired ID, suspended GSTIN, no-GST path', () => {
  const sign = { quality: 'ok', fields: { name: 'A B', idNumber: 'SYN-ID-1', validTill: '2020-01-01', business: 'Shop' } };
  const addr = { quality: 'ok', fields: { billDate: '2026-07-01', billedTo: 'Shop', address: 'x' } };
  const r1 = evaluate({ docs: { signatory: sign, address: addr }, declaredNoGstin: true, declaredNoUdyam: true }, { needsGstin: false, today: TODAY });
  assert.ok(codes(r1).includes('signatory_expired'));
  const clean = { ...sign, fields: { ...sign.fields, validTill: '2030-01-01' } };
  const r2 = evaluate({ docs: { signatory: clean, address: addr }, declaredNoGstin: true, declaredNoUdyam: true }, { needsGstin: false, today: TODAY });
  assert.equal(r2.verdict, 'verified');
  const r3 = evaluate({ docs: { signatory: clean, address: addr }, declaredNoGstin: true, declaredNoUdyam: true }, { needsGstin: true, today: TODAY });
  assert.equal(r3.verdict, 'blocked');
  const suspended = readCsv('mock_gstin_registry.csv').find((g) => g.status === 'Suspended');
  const r4 = evaluate({ gstinEntered: suspended.gstin, declaredNoUdyam: true, docs: { signatory: clean, address: addr } }, { today: TODAY });
  assert.equal(r4.verdict, 'blocked');
});

test.after(async () => { await closeOcr(); });
