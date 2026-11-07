import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './catalogue.js';

const model = JSON.parse(readFileSync(path.join(DATA_DIR, 'propensity.json')));
const SEGMENT = { micro: 'Micro retail & services', multi: 'Small multi-site businesses', mfg: 'Small manufacturers' };
const MEDIAN_SPEND = { micro: 900, prof: 2600, multi: 9150, mfg: 14300 };

export function propensity({ segment, source, gstin, udyam, cityTier, lang, employees, spend }) {
  const c = model.coef;
  const z = (v, k) => (Math.log1p(v) - model.scale.mean[k]) / model.scale.std[k];
  let score = model.intercept;
  score += c.log_spend * z(spend ?? MEDIAN_SPEND[segment] ?? 1400, 'log_spend');
  score += c.log_emp * z(employees ?? 5, 'log_emp');
  if (gstin === 'yes') score += c.gst;
  if (udyam) score += c.udyam;
  if (cityTier === 1) score += c.tier1;
  if (!['en', 'hi'].includes(lang)) score += c.regional;
  score += c[`seg_${SEGMENT[segment]}`] ?? 0;
  score += c[`src_${source}`] ?? 0;
  return Math.round((1 / (1 + Math.exp(-score))) * 100);
}
