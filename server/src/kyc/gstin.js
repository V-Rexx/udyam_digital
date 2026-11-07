const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const GST_STATE_CODES = {
  '03': 'Punjab', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar',
  '19': 'West Bengal', '23': 'Madhya Pradesh', '24': 'Gujarat', '27': 'Maharashtra',
  '29': 'Karnataka', '32': 'Kerala', '33': 'Tamil Nadu', '36': 'Telangana', '37': 'Andhra Pradesh',
};

const SHAPE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

export function checksumChar(first14) {
  let total = 0;
  for (let i = 0; i < 14; i++) {
    const v = CHARS.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    total += Math.floor(v / 36) + (v % 36);
  }
  return CHARS[(36 - (total % 36)) % 36];
}

export const validGstin = (g) => SHAPE.test(g) && checksumChar(g.slice(0, 14)) === g[14];

const DIGIT_FROM = { O: '0', Q: '0', D: '0', I: '1', L: '1', S: '5', B: '8', Z: '2', G: '6' };
const LETTER_FROM = { 0: 'O', 1: 'I', 5: 'S', 8: 'B', 2: 'Z', 6: 'G' };
const CONFUSABLE = { I: ['J', 'L', '1'], J: ['I'], L: ['I'], O: ['0', 'Q', 'D'], 0: ['O', 'D'], Q: ['O'], D: ['O', '0'], S: ['5'], 5: ['S'], B: ['8'], 8: ['B'], Z: ['2'], 2: ['Z'], G: ['6'], 6: ['G'] };

function byPosition(raw) {
  const c = raw.split('');
  for (const i of [0, 1, 7, 8, 9, 10]) c[i] = DIGIT_FROM[c[i]] ?? c[i];
  for (const i of [2, 3, 4, 5, 6, 11]) c[i] = LETTER_FROM[c[i]] ?? c[i];
  if (c[13] === '2' || c[13] === '7') c[13] = 'Z';
  return c.join('');
}

export function repairGstin(text) {
  const raw = String(text ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (raw.length !== 15) return { value: raw, repaired: false };
  const fixed = byPosition(raw);
  if (validGstin(fixed)) return { value: fixed, repaired: fixed !== raw };
  for (let i = 0; i < 15; i++) {
    for (const alt of CONFUSABLE[fixed[i]] ?? []) {
      const tryIt = fixed.slice(0, i) + alt + fixed.slice(i + 1);
      if (validGstin(tryIt)) return { value: tryIt, repaired: true };
    }
  }
  return { value: fixed, repaired: false };
}
