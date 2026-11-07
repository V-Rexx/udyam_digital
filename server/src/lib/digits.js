export const toAsciiDigits = (text) =>
  String(text ?? '').replace(/[०-९০-৯੦-੯૦-૯௦-௯౦-౯೦-೯൦-൯]/g, (d) => String((d.codePointAt(0) & 0xf) - 6));
