import { readCsv } from '../lib/catalogue.js';

const GST = new Map(readCsv('mock_gstin_registry.csv').map((r) => [r.gstin, r]));
const UDYAM = new Map(readCsv('mock_udyam_registry.csv').map((r) => [r.udyam_number, r]));

export const lookupGstin = (gstin) => GST.get(gstin) ?? null;
export const lookupUdyam = (no) => UDYAM.get(no) ?? null;

export function findUdyamFor(name, city) {
  const n = String(name ?? '').toLowerCase().trim();
  for (const r of UDYAM.values()) {
    if (r.enterprise_name.toLowerCase() === n && (!city || r.city.toLowerCase() === String(city).toLowerCase())) return r;
  }
  return null;
}
