import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../src/lib/catalogue.js';
import { readDocument, closeOcr } from '../src/kyc/ocr.js';
import { processDocument } from '../src/kyc/index.js';
import { evaluate } from '../src/kyc/validate.js';

const NAMES = { gst: 'gst_certificate', udyam: 'udyam_certificate', signatory: 'signatory_id', address: 'address_proof' };
process.env.KYC_TODAY = '2026-07-15';
const out = {};
for (let k = 1; k <= 12; k++) {
  const id = `K${String(k).padStart(2, '0')}`;
  const docs = {};
  const raw = {};
  for (const [t, n] of Object.entries(NAMES)) {
    const f = path.join(DATA_DIR, 'kyc_documents', `${id}_${n}.png`);
    if (!existsSync(f)) continue;
    const b = readFileSync(f);
    docs[t] = await processDocument(t, b);
    const r = await readDocument(b);
    raw[t] = Math.round(r.blur) + '/' + r.skew;
  }
  const res = evaluate({ docs }, { today: new Date('2026-07-15') });
  out[id] = res.verdict;
  console.log(id, res.verdict.padEnd(14), JSON.stringify(raw));
  console.log('   issues:', res.issues.map((i) => `${i.code}@${i.doc}${i.status ? ':' + i.status : ''}`).join(', ') || 'none');
  console.log('   gstin:', res.verified.gstin, '| fields:', docs.gst?.fields?.legalName, '|', docs.address?.fields?.billDate);
}
await closeOcr();
