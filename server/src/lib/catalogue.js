import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');

export const readCsv = (name) =>
  parse(readFileSync(path.join(DATA_DIR, name)), { columns: true, skip_empty_lines: true });

export const PRODUCTS = Object.fromEntries(
  readCsv('product_catalogue.csv').map((r) => [
    r.product_id,
    {
      id: r.product_id,
      category: r.category,
      name: r.product_name,
      description: r.description,
      unit: r.unit,
      priceMin: +r.price_min_inr_per_month,
      priceMax: +r.price_max_inr_per_month,
      setup: +r.one_time_setup_inr,
      minContract: +r.min_contract_months,
      tiers: r.available_city_tiers.split(';').map(Number),
      minEmployees: +r.min_employees,
      minSites: +r.min_sites,
      requiresGstin: r.requires_gstin === 'Y',
      requiresOneOf: r.requires_one_of ? r.requires_one_of.split('|') : [],
      installDays: +r.typical_install_days,
      segments: r.target_segments.split(';'),
    },
  ]),
);

export const CITIES = (() => {
  const out = {};
  for (const r of readCsv('smb_leads.csv')) out[r.city] = { tier: +r.city_tier, state: r.state };
  return out;
})();
