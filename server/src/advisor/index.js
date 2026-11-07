import { extract, mergeProfile } from './extract.js';
import { understand, explain, llmEnabled } from './llm.js';
import { QUESTIONS, CHIPS, NEEDS_BY_SEGMENT, TEXT, LOCKED, say, cityLabel } from './copy.js';
import { recommend, buildQuote, classifySegment, cityInfo } from '../engine/recommend.js';
import { PRODUCTS } from '../lib/catalogue.js';

const ORDER = ['businessType', 'city', 'employees', 'sites', 'currentSetup', 'gstin', 'fibre', 'needs'];

export function nextSlot(p) {
  for (const s of ORDER) {
    if (s === 'needs' && (p.needs?.length || p.requested?.length || p.mobileOnly)) continue;
    if ((s === 'fibre' || s === 'currentSetup') && (p.mobileOnly || p.keepInternet)) continue;
    if (p[s] == null) return s;
  }
  return null;
}

export function questionUI(slot, profile, lang) {
  const label = (c) => ({ value: c.value, label: c.label[lang] ?? c.label.en });
  if (slot === 'businessType') {
    return { kind: 'chips', options: Object.values(CHIPS.businessType).flat().map(label) };
  }
  if (slot === 'currentSetup') return { kind: 'chips', options: CHIPS.currentSetup.map(label) };
  if (slot === 'gstin' || slot === 'fibre') return { kind: 'chips', options: CHIPS.yesNoUnsure[slot].map(label) };
  if (slot === 'employees' || slot === 'sites') return { kind: 'number', min: 1 };
  if (slot === 'city') return { kind: 'city', options: ['Delhi', 'Mumbai', 'Bengaluru', 'Pune', 'Hyderabad', 'Chennai', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Nagpur', 'Surat'].map((c) => ({ value: c, label: cityLabel(c, lang) })) };
  if (slot === 'needs') {
    const seg = classifySegment(profile);
    return { kind: 'multi', options: NEEDS_BY_SEGMENT[seg].map((n) => label(CHIPS.needs[n])) };
  }
  return null;
}

function applyAnswer(profile, update) {
  const p = mergeProfile(profile, update);
  if (update.city != null) {
    const info = cityInfo(p.city);
    p.city = info?.city ?? p.city;
    p.cityTier = info?.tier ?? null;
    p.state = info?.state ?? null;
  }
  if (p.needs?.includes('mobile') && p.needs.length === 1) p.mobileOnly = true;
  return p;
}

export async function advise({ message, value, label, slot, profile: before, lang }) {
  let profile = before ?? {};
  const asked = slot ?? nextSlot(profile);
  let reply = '';
  let source = 'scripted';
  let flags = {};

  if (value !== undefined && value !== null) {
    profile = applyAnswer(profile, { [asked]: value });
    if (asked === 'businessType' && typeof label === 'string') profile.businessLabel = label.slice(0, 80);
  } else {
    const local = extract(message, asked);
    flags = local._flags ?? {};
    delete local._flags;
    let update = local;
    if (llmEnabled()) {
      try {
        const provisional = applyAnswer(profile, local);
        const ai = await understand({ message, profile: provisional, askSlot: nextSlot(provisional), lang });
        update = { ...ai.slots, ...local };
        if (ai.slots.businessType) update.businessType = ai.slots.businessType;
        if (ai.slots.city) update.city = ai.slots.city;
        if (ai.slots.addNeeds || local.addNeeds) update.addNeeds = [...new Set([...(ai.slots.addNeeds ?? []), ...(local.addNeeds ?? [])])];
        if (ai.slots.requested || local.requested) update.requested = [...new Set([...(ai.slots.requested ?? []), ...(local.requested ?? [])])];
        if (ai.reply) { reply = ai.reply; source = 'llm'; }
      } catch (err) {
        console.warn('Advisor LLM unavailable, using scripted reply:', err.message);
      }
    }
    profile = applyAnswer(profile, update);
  }

  const next = nextSlot(profile);

  const rec = next ? null : recommend(profile);
  const earlyHandoff = profile.humanRequested ? 'asked_for_person' : (profile.city && profile.cityTier == null ? 'city_not_served' : null);
  const handoffReason = earlyHandoff ?? rec?.handoff ?? null;

  if (next && !handoffReason) {
    if (!reply) reply = (flags.discount ? `${say(TEXT.noDiscount, lang)} ` : '') + (flags.outOfCatalogue ? `${say(TEXT.notInCatalogue, lang)} ` : '') + say(QUESTIONS[next], lang);
    return { profile, reply, source, slot: next, ui: questionUI(next, profile, lang), bundle: null, handoffReason: null };
  }

  if (handoffReason && !rec) {
    return {
      profile, source, slot: null, ui: null, bundle: null, handoffReason,
      reply: say(TEXT.handoff[handoffReason], lang, { city: profile.city }),
    };
  }

  const quote = buildQuote(profile, rec.items);
  let summary = '';
  let summarySource = 'scripted';
  if (llmEnabled()) {
    try {
      summary = await explain({ profile, quote, excluded: rec.excluded, lang });
      if (summary) summarySource = 'llm';
    } catch (err) {
      console.warn('Advisor LLM unavailable, using scripted summary:', err.message);
    }
  }
  if (!summary) {
    summary = (flags.discount ? `${say(TEXT.noDiscount, lang)} ` : '') + (flags.outOfCatalogue ? `${say(TEXT.notInCatalogue, lang)} ` : '') +
      say(TEXT.bundleReady, lang, { type: profile.businessLabel ?? profile.businessType, monthly: quote.monthly.toLocaleString('en-IN') });
    const refused = rec.excluded.slice(0, 3).map((e) => `${PRODUCTS[e.id].name}: ${say(LOCKED[e.code] ?? LOCKED.dependency, lang, { need: e.need })}`);
    if (refused.length) summary += `\n\n${refused.join('\n')}`;
  }
  return {
    profile, slot: null, ui: null, source: summarySource,
    reply: summary,
    bundle: { items: rec.items, excluded: rec.excluded, notes: rec.notes },
    handoffReason,
    handoffText: handoffReason ? say(TEXT.handoff[handoffReason], lang, { city: profile.city }) : null,
  };
}

export const productName = (id) => PRODUCTS[id]?.name ?? id;
