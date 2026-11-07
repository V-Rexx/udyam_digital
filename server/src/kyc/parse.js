const clean = (s) => (s ?? '').replace(/[|_]/g, ' ').replace(/\s+/g, ' ').trim();

const after = (text, label) => {
  const m = text.match(new RegExp(`${label}[ \\t:]*([^\\n]*)`, 'i'));
  return m ? clean(m[1]) : '';
};
const nextLine = (text, label) => {
  const lines = text.split('\n').map(clean).filter(Boolean);
  const i = lines.findIndex((l) => new RegExp(`^${label}$`, 'i').test(l));
  return i >= 0 ? lines[i + 1] ?? '' : '';
};
const date = (s) => (s.match(/\d{4}-\d{2}-\d{2}/) ?? [''])[0];

const wrapped = (a, b) => clean(`${a}${b}`.replace(/\s*-\s*-?\s*/g, ' - '));

export function detectType(text) {
  const t = text.toLowerCase();
  if (t.includes('gst registration') || /gstin/.test(t)) return 'gst';
  if (t.includes('udyam')) return 'udyam';
  if (t.includes('signatory') || t.includes('syn-id')) return 'signatory';
  if (t.includes('electricity') || t.includes('billed to') || t.includes('consumer no')) return 'address';
  return null;
}

export function parseFields(type, text) {
  if (type === 'gst') {
    const raw = after(text, 'GSTIN').split(' ')[0];
    const lines = text.split('\n').map(clean);
    const a1 = after(text, 'Address of principal');
    const a2 = after(text, 'place of business');
    void lines;
    return {
      gstinRaw: raw,
      legalName: after(text, 'Legal name'),
      tradeName: after(text, 'Trade name'),
      constitution: after(text, 'Constitution'),
      address: wrapped(a1, a2),
      liabilityDate: date(after(text, 'Date of liability')),
    };
  }
  if (type === 'udyam') {
    const m = text.match(/UDYAM\s*-\s*[A-Z]{2}\s*-\s*00\s*-\s*\d{5,8}/i);
    return {
      udyamNumber: m ? m[0].replace(/\s/g, '').toUpperCase() : '',
      enterpriseName: after(text, 'Enterprise name'),
      majorActivity: after(text, 'Major activity'),
      city: after(text, 'City'),
      state: after(text, 'State'),
      registrationDate: date(after(text, 'Date of registration')),
    };
  }
  if (type === 'signatory') {
    return {
      name: nextLine(text, 'Name') || after(text, 'Name'),
      designation: nextLine(text, 'Designation') || after(text, 'Designation'),
      business: nextLine(text, 'For business') || after(text, 'For business'),
      idNumber: (text.match(/SYN-ID-\d+/i) ?? [''])[0].toUpperCase(),
      validTill: date(nextLine(text, 'Valid till') || after(text, 'Valid till')),
    };
  }
  if (type === 'address') {
    const lines = text.split('\n').map(clean).filter(Boolean);
    const i = lines.findIndex((l) => /^Supply address/i.test(l));
    const a1 = i >= 0 ? lines[i].replace(/^Supply address/i, '').trim() : '';
    const a2 = i >= 0 && !/^Bill date/i.test(lines[i + 1] ?? '') ? lines[i + 1] ?? '' : '';
    return {
      billedTo: after(text, 'Billed to'),
      address: wrapped(a1, a2),
      billDate: date(after(text, 'Bill date')),
    };
  }
  return {};
}
