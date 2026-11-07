import test from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, LANGUAGES } from '../../client/src/i18n.js';
import { QUESTIONS, CHIPS, REASONS, LOCKED, TEXT, cityLabel } from '../src/advisor/copy.js';
import { stageLabel } from '../src/lib/orders.js';
import { LOCALES, CITY_ORDER } from '../src/advisor/locales.js';
import { readCsv, CITIES } from '../src/lib/catalogue.js';

const SCRIPT = { hi: /[ऀ-ॿ]/, mr: /[ऀ-ॿ]/, bn: /[ঀ-৿]/, gu: /[઀-૿]/, kn: /[ಀ-೿]/, ml: /[ഀ-ൿ]/, pa: /[਀-੿]/, ta: /[஀-௿]/, te: /[ఀ-౿]/ };
const SAME = /^(GSTIN|CCTV|OTP|\+ 18% GST|[^\s]*Accel Business[^\s]*)$/;
const langs = LANGUAGES.map(([k]) => k).filter((k) => k !== 'en');

const flatten = (o, prefix = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]));
const en = Object.fromEntries(flatten(STRINGS.en));

test('10 languages on offer', () => assert.equal(LANGUAGES.length, 10));

for (const lang of langs) {
  test(`${lang}: every screen string is present and translated`, () => {
    const got = Object.fromEntries(flatten(STRINGS[lang]));
    assert.deepEqual(Object.keys(got).sort(), Object.keys(en).sort());
    const bad = [];
    for (const [k, v] of Object.entries(got)) {
      if (typeof v !== 'string' || !v.trim()) bad.push(`${k} empty`);
      else if (!SAME.test(v) && !SCRIPT[lang].test(v)) bad.push(`${k} = ${v}`);
    }
    assert.deepEqual(bad, []);
  });

  test(`${lang}: placeholders match English`, () => {
    const got = Object.fromEntries(flatten(STRINGS[lang]));
    const holes = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const [k, v] of Object.entries(got)) assert.equal(holes(v), holes(en[k]), `${lang}.${k}`);
  });

  test(`${lang}: every advisor string is present and translated`, () => {
    const check = (name, entry) => {
      assert.ok(entry[lang], `${lang} ${name} missing`);
      if (!SAME.test(entry[lang])) assert.match(entry[lang], SCRIPT[lang], `${lang} ${name} = ${entry[lang]}`);
      assert.equal((entry[lang].match(/\{\w+\}/g) ?? []).sort().join(), (entry.en.match(/\{\w+\}/g) ?? []).sort().join(), `${lang} ${name} placeholders`);
    };
    for (const [k, e] of Object.entries(QUESTIONS)) check(`q.${k}`, e);
    for (const [k, e] of Object.entries(REASONS)) check(`r.${k}`, e);
    for (const [k, e] of Object.entries(LOCKED)) check(`l.${k}`, e);
    for (const k of ['bundleReady', 'notInCatalogue', 'noDiscount']) check(`t.${k}`, TEXT[k]);
    for (const [k, e] of Object.entries(TEXT.handoff)) check(`h.${k}`, e);
    for (const [k, e] of Object.entries(stageLabel)) check(`s.${k}`, e);
    for (const c of Object.values(CHIPS.businessType).flat()) check(`b.${c.value}`, c.label);
    for (const c of CHIPS.currentSetup) check(`c.${c.value}`, c.label);
    for (const group of Object.values(CHIPS.yesNoUnsure)) for (const c of group) check(`y.${c.value}`, c.label);
    for (const [k, c] of Object.entries(CHIPS.needs)) check(`n.${k}`, c.label);
    for (const city of CITY_ORDER) assert.match(cityLabel(city, lang), SCRIPT[lang], `${lang} ${city}`);
  });
}

test('the city list and units match the data pack', () => {
  assert.deepEqual([...CITY_ORDER].sort(), Object.keys(CITIES).sort());
  const units = [...new Set(readCsv('product_catalogue.csv').map((r) => r.unit))].sort();
  for (const lang of Object.keys(STRINGS)) assert.deepEqual(Object.keys(STRINGS[lang].units).sort(), units, lang);
  for (const v of Object.values(LOCALES)) assert.equal(v.cities.length, CITY_ORDER.length);
});
