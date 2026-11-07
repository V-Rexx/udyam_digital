import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const langPath = path.join(path.dirname(require.resolve('@tesseract.js-data/eng/package.json')), '4.0.0_best_int');

let workerPromise;
const worker = () => (workerPromise ??= createWorker('eng', 1, { langPath, cacheMethod: 'none', gzip: true, logger: () => {} }));

export const WIDTH = 1500;

const toGray = (input) => sharp(input).rotate().flatten({ background: '#fff' }).resize({ width: WIDTH, withoutEnlargement: false }).extractChannel('red');

async function sharpness(input) {
  const { data, info } = await sharp(input).rotate().flatten({ background: '#fff' }).greyscale().resize({ width: 1000 }).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let sum = 0, sq = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = data[i - 1] + data[i + 1] + data[i - w] + data[i + w] - 4 * data[i];
      sum += v; sq += v * v; n++;
    }
  }
  return sq / n - (sum / n) ** 2;
}

async function findSkew(input) {
  const { data, info } = await sharp(input).rotate().flatten({ background: '#fff' }).extractChannel('red').resize({ width: 500 }).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const dark = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[y * w + x] < 110) dark.push([x, y]);
  let best = 0, bestScore = -1;
  for (let a = -12; a <= 12; a += 0.5) {
    const t = Math.tan((a * Math.PI) / 180);
    const rows = new Float64Array(h * 2);
    for (const [x, y] of dark) { const r = Math.round(y + x * t + h / 2); if (r >= 0 && r < rows.length) rows[r]++; }
    let score = 0;
    for (let i = 1; i < rows.length; i++) score += (rows[i] - rows[i - 1]) ** 2;
    if (score > bestScore) { bestScore = score; best = a; }
  }
  return best;
}

export async function readDocument(buffer) {
  const blur = await sharpness(buffer);
  const skew = await findSkew(buffer);
  let img = await toGray(buffer).png().toBuffer();
  if (Math.abs(skew) >= 1) {
    img = await sharp(img).rotate(skew, { background: '#fff' }).png().toBuffer();
  }
  const w = await worker();
  const { data } = await w.recognize(img);
  return { text: data.text, confidence: data.confidence, blur, skew };
}

export async function rereadVariants(buffer) {
  const skew = await findSkew(buffer);
  const out = [];
  const w = await worker();
  for (const width of [1240, 2000, 2600]) {
    let img = await sharp(buffer).rotate().flatten({ background: '#fff' }).resize({ width }).extractChannel('red').linear(1.4, -60).png().toBuffer();
    if (Math.abs(skew) >= 1) img = await sharp(img).rotate(skew, { background: '#fff' }).png().toBuffer();
    const { data } = await w.recognize(img);
    out.push(data.text);
  }
  return out;
}

export async function closeOcr() {
  if (workerPromise) { const w = await workerPromise; await w.terminate(); workerPromise = null; }
}
