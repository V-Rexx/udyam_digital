import { PRODUCTS, CITIES } from '../lib/catalogue.js';
import { cityFromLocalName } from './copy.js';
import { toAsciiDigits } from '../lib/digits.js';

const NEED_WORDS = {
  payments: /billing|\bbill\b|\bpos\b|upi|invoice|बिलिंग|बिल |भुगतान|पेमेंट/i,
  whatsapp: /whats ?app|व्हाट्स|वॉट्स|व्हॉट्स/i,
  sms: /\bsms\b|एसएमएस/i,
  website: /website|web site|वेबसाइट|वेबसाईट/i,
  cctv: /cctv|camera|कैमरा|कॅमेरा|सीसीटीवी/i,
  wifi: /wi-?fi|वाई-?फाई|वायफाय/i,
  email: /\bemail|e-mail|gmail|ईमेल/i,
  backup: /backup|back up|बैकअप|बॅकअप/i,
  security: /antivirus|virus|ransomware|endpoint|security|वायरस|सुरक्षा/i,
  firewall: /firewall|फ़ायरवॉल|फायरवॉल/i,
  failover: /failover|fail over|uptime|internet goes down|internet down|बैकअप इंटरनेट/i,
  telephony: /telephony|ivr|sip\b|phone lines?|landline/i,
  tollfree: /toll.?free|1800|टोल.?फ्री/i,
  central: /sd-?wan|central|one screen|manage all/i,
  fleet: /fleet|vehicle|gps|truck|गाड़ी|वाहन/i,
  machines: /machine|iot|sensor|मशीन/i,
  dedicated: /dedicated|leased line|लीज़्ड|लीज्ड/i,
  mobile: /\bsim\b|sims\b|mobile plan|postpaid|सिम|मोबाइल प्लान/i,
};

const PRODUCT_WORDS = [
  [/sd-?wan/i, 'P10'], [/leased line 100|100 ?mbps leased/i, 'P06'], [/leased line/i, 'P05'], [/1 ?g\b|1 ?gbps|gigabit/i, 'P03'], [/300 ?mbps/i, 'P02'],
  [/airfiber|5g fwa|5g broadband/i, 'P04'], [/static ip/i, 'P11'], [/managed firewall/i, 'P21'],
];

const num = (s) => {
  const m = toAsciiDigits(s).match(/\d[\d,]*/);
  return m ? parseInt(m[0].replace(/,/g, ''), 10) : null;
};

const END = '(?=$|[\\s,.!।])';
const WORDS_YES = new RegExp(`^(yes|yeah|yep|y|haan|han|ha|हाँ|हां|जी|होय|हो|হ্যাঁ|হাঁ|હા|ಹೌದು|അതെ|ഉണ്ട്|ਹਾਂ|ஆம்|ஆமாம்|అవును)${END}`, 'i');
const WORDS_NO = new RegExp(`^(no|nope|n|nahi|nahin|नहीं|नही|नाही|না|ના|ಇಲ್ಲ|ഇല്ല|ਨਹੀਂ|இல்லை|లేదు|కాదు)${END}`, 'i');

const LOCAL_TYPES = /किराना दुकान|किराणा दुकान|क्लिनिक|दवाखाना|सैलून|सलून|बेकरी|फार्मेसी|मेडिकल|कोचिंग|रेस्टोरेंट|रेस्टॉरंट|फैक्ट्री|दुकान/;

function shortType(text) {
  const t = text.split(/[.!?]\s/)[0];
  const m = t.match(/(?:\ba|\ban|\bour|\bmy)\s+([a-z][a-z& -]{2,40}?)(?=\s+(?:in|at|with|and|of|near|called|named)\b|[,.]|$)/i);
  if (m) return m[1].trim();
  const local = t.match(LOCAL_TYPES);
  if (local) return local[0];
  return t.split(/\s+(?:in|at|with)\s+|[,.।]/i)[0].trim() || t;
}

export function extract(text, askedSlot) {
  const t = String(text ?? '').trim();
  const out = {};
  if (!t) return out;

  const wantsPerson = /(talk|speak|connect).{0,20}(person|human|agent|someone|executive|sales)|human agent/i;
  if (askedSlot === 'businessType' && !/\d{3}/.test(t) && !(wantsPerson.test(t) && !/[.,]/.test(t.split(wantsPerson)[0]))) out.businessType = shortType(t);
  if (askedSlot === 'employees' && num(t) != null) out.employees = num(t);
  if (askedSlot === 'sites' && num(t) != null) out.sites = num(t);
  if (askedSlot === 'city' && /^[\x00-\x7F]+$/.test(t)) out.city = t.replace(/^(i am |i'm |we are |we're )?(in|at|from)\s+/i, '').replace(/[.!]+$/, '');
  if (askedSlot === 'gstin') {
    if (WORDS_YES.test(t)) out.gstin = 'yes';
    else if (WORDS_NO.test(t) || /don.?t have|no gst|without gst/i.test(t)) out.gstin = 'no';
  }
  if (askedSlot === 'fibre') {
    if (WORDS_YES.test(t)) out.fibre = 'yes';
    else if (WORDS_NO.test(t)) out.fibre = 'no';
    else if (/not sure|don.?t know|पता नहीं|माहीत नाही|unsure/i.test(t)) out.fibre = 'unsure';
  }

  if (/hotspot|tether|phone internet|mobile data|हॉटस्पॉट/i.test(t)) out.currentSetup = 'hotspot';
  else if (/leased line|ill\b|लीज़्ड|लीज्ड/i.test(t) && askedSlot === 'currentSetup') out.currentSetup = 'leased';
  else if (/mixed|different (isp|provider)|each (site|branch)|local isps?|हर जगह अलग/i.test(t)) out.currentSetup = 'mixed';
  else if (/business broadband|office broadband|बिज़नेस ब्रॉडबैंड/i.test(t)) out.currentSetup = 'business';
  else if (/home (broadband|wi-?fi|internet)|घर का/i.test(t)) out.currentSetup = 'home';
  else if (askedSlot === 'currentSetup') out.currentSetup = 'other';

  const emp = t.match(/(\d[\d,]*)\s*(people|staff|employees|workers|लोग|कर्मचारी|लोक)/i);
  if (emp) out.employees = num(emp[1]);
  const site = t.match(/(\d+)\s*(sites?|branch(es)?|locations?|outlets?|stores?|shops?|शाखा|जगह|दुकान)/i);
  if (site) out.sites = num(site[1]);
  const place = t.match(/\b(?:in|at|from)\s+([A-Z][a-z]{3,})\b/);
  if (place && !['English', 'Hindi', 'Marathi'].includes(place[1])) out.city = place[1];
  for (const c of Object.keys(CITIES)) if (new RegExp(`\\b${c}\\b`, 'i').test(t)) out.city = c;
  const local = cityFromLocalName(t);
  if (local) out.city = local;
  if (/no gst|without gst|not registered|gst nahi|जीएसटी नहीं|GST नहीं|GST नाही/i.test(t)) out.gstin = 'no';
  else if (/have gst|gst registered|gstin|registered under gst/i.test(t) && !out.gstin) out.gstin = 'yes';
  if (/no fibre|no fiber|fibre (is )?not available|fiber (is )?not available|फाइबर नहीं/i.test(t)) out.fibre = 'no';
  const budget = t.match(/(?:budget|under|below|within|बजट|से कम)\D{0,12}(?:₹|rs\.?|inr)?\s*(\d[\d,]*)/i) ?? t.match(/(?:₹|rs\.?)\s*(\d[\d,]*)\s*(?:a month|per month|monthly|\/month|महीना|महिना)/i);
  if (budget) out.budget = num(budget[1]);

  const needs = Object.entries(NEED_WORDS).filter(([, re]) => re.test(t)).map(([k]) => k);
  const negative = /(don.?t|do not|no need|without|remove|drop|nahi chahiye|नहीं चाहिए|नको|हटा)/i.test(t);
  if (needs.length && !negative) out.addNeeds = needs;
  if (negative) {
    const drop = needs.map((n) => ({ payments: 'P19', whatsapp: 'P15', sms: 'P14', website: 'P18', cctv: 'P23', wifi: 'P22', email: 'P16', backup: 'P17', security: 'P20', firewall: 'P21', failover: 'P09', telephony: 'P12', tollfree: 'P13', central: 'P10', fleet: 'P25', machines: 'P24' }[n])).filter(Boolean);
    if (drop.length) out.excluded = drop;
  }
  if (!negative) {
    const req = PRODUCT_WORDS.filter(([re]) => re.test(t)).map(([, id]) => id);
    if (req.length) out.requested = req;
    for (const p of Object.values(PRODUCTS)) if (t.toLowerCase().includes(p.name.toLowerCase())) (out.requested ??= []).push(p.id);
  }
  if (/only (a )?(mobile|sim|postpaid)|just (a )?(mobile|sim|postpaid)|सिर्फ़? (मोबाइल|सिम)|फक्त (मोबाइल|सिम)/i.test(t)) out.mobileOnly = true;
  if (/already have (internet|broadband|wi-?fi)|keep my (internet|broadband)/i.test(t)) out.keepInternet = true;
  if (/(talk|speak|connect).{0,20}(person|human|agent|someone|executive|sales)|call me|human agent|किसी से बात|कॉल कीजिए|कॉल करा/i.test(t)) out.humanRequested = true;

  out._flags = {
    discount: /discount|cheaper|free\b|waive|% ?off|छूट|डिस्काउंट|सूट\b/i.test(t),
    outOfCatalogue: /satellite|dth|\btv\b|solar|insurance plan|loan|laptop/i.test(t),
  };
  return out;
}

export function mergeProfile(profile, u = {}) {
  const p = { ...profile };
  const pos = (v, max) => (Number.isFinite(+v) && +v >= 1 && +v <= max ? Math.round(+v) : undefined);
  if (typeof u.businessType === 'string' && u.businessType.trim()) p.businessType = u.businessType.trim().slice(0, 80);
  for (const [k, max] of [['employees', 100000], ['sites', 10000], ['lines', 500], ['users', 500], ['devices', 500], ['cameras', 500], ['counters', 100], ['vehicles', 500], ['machines', 500]]) {
    if (u[k] != null && pos(u[k], max)) p[k] = pos(u[k], max);
  }
  if (u.budget != null && pos(u.budget, 10000000)) p.budget = pos(u.budget, 10000000);
  if (['hotspot', 'home', 'business', 'leased', 'mixed', 'other'].includes(u.currentSetup)) p.currentSetup = u.currentSetup;
  if (['yes', 'no'].includes(u.gstin)) p.gstin = u.gstin;
  if (['yes', 'no', 'unsure'].includes(u.fibre)) p.fibre = u.fibre;
  if (typeof u.city === 'string' && u.city.trim()) p.city = u.city.trim().slice(0, 60);
  const ids = (a) => (Array.isArray(a) ? a.filter((x) => PRODUCTS[x]) : []);
  if (Array.isArray(u.needs)) p.needs = u.needs.filter((n) => typeof n === 'string').slice(0, 20);
  if (Array.isArray(u.addNeeds)) p.needs = [...new Set([...(p.needs ?? []), ...u.addNeeds])];
  if (ids(u.requested).length) p.requested = [...new Set([...(p.requested ?? []), ...ids(u.requested)])];
  if (ids(u.excluded).length) {
    p.excluded = [...new Set([...(p.excluded ?? []), ...ids(u.excluded)])];
    p.requested = (p.requested ?? []).filter((r) => !p.excluded.includes(r));
  }
  if (u.mobileOnly === true) p.mobileOnly = true;
  if (u.keepInternet === true) p.keepInternet = true;
  if (u.humanRequested === true) p.humanRequested = true;
  return p;
}
