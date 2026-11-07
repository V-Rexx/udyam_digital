import { readDocument, rereadVariants } from './ocr.js';
import { repairGstin, validGstin } from './gstin.js';
import { detectType, parseFields } from './parse.js';
import { MIN_SHARPNESS } from './validate.js';

export async function processDocument(type, buffer) {
  const r = await readDocument(buffer);
  const blurred = r.blur < MIN_SHARPNESS;
  const found = detectType(r.text);
  const fields = blurred ? {} : parseFields(type, r.text);
  if (type === 'gst' && !blurred && !validGstin(repairGstin(fields.gstinRaw).value)) {
    const reads = (await rereadVariants(buffer)).map((t) => repairGstin(parseFields('gst', t).gstinRaw).value);
    const good = reads.find(validGstin);
    if (good) fields.gstinRaw = good;
    else fields.gstinReadsAgree = reads.filter((x) => x.length === 15 && x === repairGstin(fields.gstinRaw).value).length >= 2;
    fields.gstinReads = reads;
  }
  return {
    type,
    quality: blurred ? 'blurred' : 'ok',
    wrongType: !blurred && found && found !== type ? found : null,
    fields,
    confidence: Math.round(r.confidence),
    deskewed: Math.abs(r.skew) >= 1,
  };
}
