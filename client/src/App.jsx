import { useEffect, useRef, useState } from 'react';
import { LANGUAGES, SPEECH_LANG, dict, fill, rupees, unitText } from './i18n.js';
import Ops from './Ops.jsx';

async function api(path, options = {}) {
  const isForm = options.body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: isForm ? options.headers : { 'Content-Type': 'application/json', ...options.headers },
    body: isForm ? options.body : options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error ?? 'request_failed'); e.code = data.error; e.data = data; throw e; }
  return data;
}
const store = {
  get: () => { try { return localStorage.getItem('udyam.journey'); } catch { return null; } },
  set: (t) => { try { localStorage.setItem('udyam.journey', t); } catch {  } },
  clear: () => { try { localStorage.removeItem('udyam.journey'); } catch {  } },
};

const STEPS = ['advice', 'quote', 'docs', 'order', 'track'];

function Steps({ current, t }) {
  const labels = { advice: t.stepAdvice, quote: t.stepQuote, docs: t.stepDocs, order: t.stepOrder, track: t.stepTrack };
  const at = STEPS.indexOf(current);
  return (
    <ol className="steps" aria-label={labels[current]}>
      {STEPS.map((s, i) => <li key={s} className={i < at ? 'done' : i === at ? 'now' : ''} aria-current={i === at ? 'step' : undefined} />)}
      <span className="steps-label">{labels[current]}</span>
    </ol>
  );
}

function Header({ lang, setLang }) {
  return (
    <header className="top">
      <a className="brand" href="/">Accel <span>Business</span></a>
      <select className="lang" value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Language">
        {LANGUAGES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
      </select>
    </header>
  );
}

function Welcome({ lang, setLang, onStart, resumable, onResume, busy, error }) {
  const t = dict(lang);
  return (
    <main className="welcome">
      <h1>{t.heroTitle}</h1>
      <p className="lede">{t.heroBody}</p>
      <div className="specimen-bill" aria-hidden="true">
        <div className="sb-row"><span>Biz Fibre 300</span><span /></div>
        <div className="sb-row"><span>2 × Business Postpaid</span><span /></div>
        <div className="sb-row"><span>Cloud CCTV</span><span /></div>
        <div className="sb-total">1</div>
      </div>
      <label className="field-label" htmlFor="lang-pick">{t.pickLanguage}</label>
      <div className="lang-grid" id="lang-pick" role="radiogroup">
        {LANGUAGES.map(([k, n]) => (
          <button key={k} type="button" role="radio" aria-checked={lang === k} className={`chip ${lang === k ? 'on' : ''}`} onClick={() => setLang(k)}>{n}</button>
        ))}
      </div>
      {error && <p className="error" role="alert">{t.errGeneric}</p>}
      <button className="cta" onClick={onStart} disabled={busy}>{t.start}</button>
      {resumable && <button className="link" onClick={onResume}>{t.continue}</button>}
      <a className="link" href="/track">{t.trackLink}</a>
    </main>
  );
}

function Advisor({ j, send, busy, t, goQuote }) {
  const [text, setText] = useState('');
  const [picked, setPicked] = useState([]);
  const [listening, setListening] = useState(false);
  const end = useRef(null);
  const ui = j.ui;
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); setPicked([]); }, [j.messages.length]);

  const speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  const listen = () => {
    const r = new speech();
    r.lang = SPEECH_LANG[j.lang] ?? 'en-IN';
    r.onresult = (e) => { const said = e.results[0][0].transcript; setText(said); };
    r.onend = () => setListening(false);
    setListening(true);
    r.start();
  };
  const submit = (e) => {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    setText('');
    if (ui?.kind === 'number' && /^\d+$/.test(v)) send({ value: Number(v), label: v });
    else send({ text: v });
  };
  return (
    <main className="chat">
      <div className="log" aria-live="polite">
        {j.messages.map((m, i) => <p key={i} className={`msg ${m.from}`}>{m.text}</p>)}
        {busy && <p className="msg advisor thinking">{t.thinking}</p>}
        <div ref={end} />
      </div>
      <div className="dock">
        {ui?.kind === 'chips' || ui?.kind === 'city' ? (
          <div className="chips">
            {ui.options.map((o) => <button key={o.value} className="chip" disabled={busy} onClick={() => send({ value: o.value, label: o.label })}>{o.label}</button>)}
          </div>
        ) : null}
        {ui?.kind === 'multi' ? (
          <>
            <div className="chips">
              {ui.options.map((o) => {
                const on = picked.includes(o.value);
                return <button key={o.value} className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setPicked(on ? picked.filter((x) => x !== o.value) : [...picked, o.value])}>{o.label}</button>;
              })}
            </div>
            <button className="cta" disabled={!picked.length || busy} onClick={() => send({ value: picked, label: ui.options.filter((o) => picked.includes(o.value)).map((o) => o.label).join(', ') })}>{t.done}</button>
          </>
        ) : null}
        {j.quote && !j.slot ? <button className="cta" onClick={goQuote}>{t.seeBill}</button> : null}
        {j.status !== 'handed_off' && (
          <form className="composer" onSubmit={submit}>
            <input
              value={text} onChange={(e) => setText(e.target.value)}
              placeholder={listening ? t.listening : ui?.kind === 'city' ? t.orType : t.typeHere}
              inputMode={ui?.kind === 'number' ? 'numeric' : 'text'} aria-label={t.typeHere} />
            {speech && <button type="button" className={`mic ${listening ? 'on' : ''}`} onClick={listen} aria-label={t.speak} title={t.speak}><MicIcon /></button>}
            <button className="send" disabled={!text.trim() || busy}>{t.send}</button>
          </form>
        )}
      </div>
    </main>
  );
}
const MicIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
);

function Stepper({ value, onChange, label }) {
  return (
    <span className="stepper" role="group" aria-label={label}>
      <button aria-label="−" onClick={() => onChange(value - 1)} disabled={value <= 1}>−</button>
      <output>{value}</output>
      <button aria-label="+" onClick={() => onChange(value + 1)}>+</button>
    </span>
  );
}

function Quote({ j, item, t, back, next, callback, notice }) {
  const q = j.quote;
  const budgetDrops = q.droppedForBudget ?? [];
  return (
    <main className="quote">
      <section className="bill">
        <div className="bill-head">
          <span className="bill-kicker">{t.billFor}</span>
          <div className="price"><span className="amount">{rupees(q.monthly)}</span><span className="per">{t.perMonth}</span></div>
          <p className="price-sub">{t.plusGst} · {t.withGst} {rupees(q.monthlyWithGst)}</p>
        </div>
        <ul className="bill-lines">
          {q.lines.map((l) => (
            <li key={l.id}>
              <div className="bl-top">
                <strong>{l.name}</strong>
                <span className="bl-amount">{rupees(l.monthly)}</span>
              </div>
              <p className="why">{l.why}</p>
              <div className="bl-controls">
                <Stepper value={l.qty} label={l.name} onChange={(v) => item(l.id, true, v)} />
                <span className="unit">{rupees(l.unitPrice)} {unitText(l.unitLabel, j.lang)}</span>
                {q.lines.length > 1 && <button className="link small" onClick={() => item(l.id, false)}>{t.remove}</button>}
              </div>
            </li>
          ))}
        </ul>
        <dl className="bill-foot">
          <div><dt>{t.setupOnce}</dt><dd>{rupees(q.setup)}</dd></div>
          <div><dt>{t.contract}</dt><dd>{q.contractMonths} {q.contractMonths === 1 ? t.month : t.months}</dd></div>
          <div><dt>{t.readyIn}</dt><dd>{q.installDays} {t.days}</dd></div>
        </dl>
      </section>

      {notice && <p className="notice" role="status">{notice}</p>}
      {budgetDrops.length > 0 && <p className="notice">{t.droppedBudget} {budgetDrops.join(', ')}</p>}
      {q.notes.includes('over_budget') && <p className="notice">{t.overBudget}</p>}

      {q.excluded.length > 0 && (
        <section className="panel">
          <h2>{t.notIncluded}</h2>
          <ul className="plain">
            {q.excluded.map((e) => (
              <li key={e.id}><strong>{e.name}.</strong> {e.why}{e.alternatives.length > 0 && <> {t.instead} {e.alternatives.join(', ')}.</>}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel">
        <h2>{t.addMore}</h2>
        <ul className="addons">
          {q.addons.map((a) => (
            <li key={a.id} className={a.available ? '' : 'locked'}>
              <div>
                <strong>{a.name}</strong>
                <p className="why">{a.available ? a.description : a.lockedText}</p>
              </div>
              {a.available
                ? <button className="add" onClick={() => item(a.id, true)} aria-label={`${t.add} ${a.name}`}>+ {rupees(a.unitPrice * a.qty)}</button>
                : <span className="lock-price">{rupees(a.unitPrice)}</span>}
            </li>
          ))}
        </ul>
      </section>

      <div className="links">
        <button className="link" onClick={back}>{t.changeWithAdvisor}</button>
        <button className="link" onClick={callback}>{t.talkToPerson}</button>
      </div>
      <div className="sticky-cta">
        <div><strong>{rupees(q.monthly)}</strong> <span>{t.perMonth}</span></div>
        <button className="cta" onClick={next}>{t.continue}</button>
      </div>
    </main>
  );
}

function Consent({ t, agree, busy }) {
  const [verify, setVerify] = useState(false);
  const [updates, setUpdates] = useState(false);
  const [marketing, setMarketing] = useState(false);
  return (
    <main className="page">
      <h1>{t.consentTitle}</h1>
      <p className="lede">{t.consentIntro}</p>
      <dl className="notice-list">
        <dt>{t.cCollect}</dt><dd>{t.cCollectBody}</dd>
        <dt>{t.cWhy}</dt><dd>{t.cWhyBody}</dd>
        <dt>{t.cKeep}</dt><dd>{t.cKeepBody}</dd>
        <dt>{t.cRights}</dt><dd>{t.cRightsBody}</dd>
      </dl>
      <label className="check"><input type="checkbox" checked={verify} onChange={(e) => setVerify(e.target.checked)} /><span>{t.cVerify}</span></label>
      <label className="check"><input type="checkbox" checked={updates} onChange={(e) => setUpdates(e.target.checked)} /><span>{t.cUpdates}</span></label>
      <label className="check"><input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} /><span>{t.cMarketing}</span></label>
      <button className="cta" disabled={!verify || busy} onClick={() => agree({ verification: true, updates, marketing })}>{t.agree}</button>
    </main>
  );
}

function issueText(t, i) { return fill(t.issues[i.code] ?? i.code, { ...i, status: t.gstStatus[i.status] ?? i.status }); }

function DocCard({ type, doc, issues, t, upload, busy, covered }) {
  const input = useRef(null);
  const reading = busy === type;
  const ok = doc && doc.quality === 'ok' && !doc.wrongType && !issues.length;
  return (
    <li className={`doc ${ok ? 'ok' : issues.length ? 'bad' : ''}`}>
      <div className="doc-head">
        <strong>{t.docs[type]}</strong>
        {ok && <span className="tick" aria-label={t.read}>✓</span>}
      </div>
      {!doc && !covered && <p className="why">{t.docHint[type]}</p>}
      {covered && !doc && <p className="why">{t.noNeed}</p>}
      {doc?.deskewed && <p className="why">{t.straightened}</p>}
      {issues.map((i) => <p key={i.code} className="doc-issue">{issueText(t, i)}</p>)}
      {!covered && (
        <>
          <input ref={input} className="hidden" type="file" accept="image/*" capture="environment" onChange={(e) => e.target.files[0] && upload(type, e.target.files[0])} aria-label={t.docs[type]} />
          <button className="ghost" disabled={!!busy} onClick={() => input.current.click()}>{reading ? t.reading : doc ? t.retake : t.takePhoto}</button>
        </>
      )}
    </li>
  );
}

function Kyc({ j, t, act, upload, busy, next, err }) {
  const k = j.kyc;
  const [gstin, setGstin] = useState('');
  const [udyam, setUdyam] = useState('');
  const by = (d) => k.issues.filter((i) => i.doc === d);
  const v = k.verified ?? {};
  const SPECIMENS = Array.from({ length: 12 }, (_, i) => `K${String(i + 1).padStart(2, '0')}`);
  const [spec, setSpec] = useState('K03');
  const suggestion = k.issues.find((i) => i.code === 'udyam_missing' && i.suggestion);
  const notActive = k.issues.some((i) => i.code === 'gstin_not_active');
  const gstLooked = Boolean(v.legalName);
  const showVerdict = Object.keys(k.docs).length > 0 || gstLooked;

  return (
    <main className="page">
      <h1>{t.kycTitle}</h1>

      {!k.declaredNoGstin && (
        <section className="lookup">
          <label className="field-label" htmlFor="gstin">{t.gstinLabel}</label>
          <p className="why">{t.gstinHint}</p>
          <div className="row">
            <input id="gstin" className="mono" autoCapitalize="characters" maxLength={15} value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="27ABCXE1234F1Z5" />
            <button className="ghost" disabled={gstin.length !== 15 || !!busy} onClick={() => act('lookup', { gstin })}>{t.check}</button>
          </div>
          {err === 'gstin_invalid' && <p className="doc-issue" role="alert">{t.issues.gstin_invalid}</p>}
          {gstLooked && (
            <div className={`found ${v.gstStatus === 'Active' ? '' : 'dead'}`}>
              <p className="why">{t.found}</p>
              <p><strong>{v.tradeName}</strong></p>
              <p>{t.legalName}: {v.legalName}</p>
              <p>{t.statusLabel}: {t.gstStatus[v.gstStatus] ?? v.gstStatus}</p>
            </div>
          )}
          {!k.requireGstin && <button className="link small" onClick={() => act('declare', { noGstin: true })}>{t.noGst}</button>}
        </section>
      )}

      <ul className="docs">
        {!k.declaredNoGstin && <DocCard type="gst" doc={k.docs.gst} issues={by('gst')} t={t} upload={upload} busy={busy} covered={gstLooked && !k.docs.gst} />}
        {!k.declaredNoUdyam && <DocCard type="udyam" doc={k.docs.udyam} issues={by('udyam')} t={t} upload={upload} busy={busy} covered={Boolean(v.udyam) && !k.docs.udyam} />}
        <DocCard type="signatory" doc={k.docs.signatory} issues={by('signatory')} t={t} upload={upload} busy={busy} />
        <DocCard type="address" doc={k.docs.address} issues={by('address')} t={t} upload={upload} busy={busy} />
      </ul>

      {!k.declaredNoUdyam && !v.udyam && (
        <section className="lookup">
          {suggestion && (
            <div className="found">
              <p>{t.suggested} {suggestion.suggestion.slice(-4)}.</p>
              <button className="ghost" onClick={() => act('declare', { useSuggestedUdyam: true })}>{t.useThis}</button>
            </div>
          )}
          <label className="field-label" htmlFor="udyam">{t.udyamLabel}</label>
          <div className="row">
            <input id="udyam" className="mono" autoCapitalize="characters" value={udyam} onChange={(e) => setUdyam(e.target.value.toUpperCase())} placeholder="UDYAM-MH-00-1234567" />
            <button className="ghost" disabled={udyam.length < 19 || !!busy} onClick={() => act('lookup', { udyam })}>{t.check}</button>
          </div>
          <button className="link small" onClick={() => act('declare', { noUdyam: true })}>{t.noUdyam}</button>
        </section>
      )}

      {showVerdict && (
        <div className={`verdict v-${k.verdict}`} role="status">
          <p>{t.verdict[k.verdict]}</p>
          {notActive && <button className="ghost" onClick={() => act('declare', { continueWithoutGst: true })}>{t.continueNoGst}</button>}
        </div>
      )}

      {j.demoMode && (
        <details className="demo">
          <summary>{t.specimenTitle}</summary>
          <p className="why">{t.specimenBody}</p>
          <div className="row">
            <select value={spec} onChange={(e) => setSpec(e.target.value)} aria-label={t.specimenTitle}>{SPECIMENS.map((s) => <option key={s}>{s}</option>)}</select>
            <button className="ghost" disabled={!!busy} onClick={() => act('specimen', { applicant: spec })}>{busy === 'specimen' ? t.reading : t.load}</button>
          </div>
        </details>
      )}

      <div className="links"><button className="link small" onClick={() => act('withdraw')}>{t.withdraw}</button></div>
      <div className="sticky-cta single"><button className="cta" disabled={k.verdict !== 'verified'} onClick={next}>{t.continue}</button></div>
    </main>
  );
}

function Checkout({ j, t, place, busy, err, otpAct, demoCode }) {
  const q = j.quote;
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [slot, setSlot] = useState('morning');
  const [fail, setFail] = useState(false);
  const [editing, setEditing] = useState(false);
  const due = q.setup + q.monthlyWithGst + Math.round(q.setup * 0.18);
  const validPhone = /^[6-9]\d{9}$/.test(phone);
  const sent = Boolean(j.otp) && !editing;
  const verified = Boolean(j.otp?.verified) && !editing;
  const otpMessage = { phone_invalid: t.phoneInvalid, otp_invalid: t.otpInvalid, otp_expired: t.otpExpired, otp_too_many: t.otpTooMany, otp_wait: t.otpWait, otp_required: t.otpRequired, sms_unavailable: t.errGeneric }[err];
  const send = async () => { if (await otpAct('send', { phone })) { setEditing(false); setCode(''); } };
  return (
    <main className="page">
      <h1>{t.checkoutTitle}</h1>
      <label className="field-label" htmlFor="phone">{t.mobile}</label>
      {verified || sent ? (
        <div className="row phone-done">
          <output id="phone" className="mono">{j.otp.phone}</output>
          {!verified && <button className="link small" onClick={() => setEditing(true)}>{t.changeNumber}</button>}
        </div>
      ) : (
        <div className="row">
          <input id="phone" inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} autoComplete="tel-national" />
          <button className="ghost" disabled={!validPhone || busy} onClick={send}>{t.sendOtp}</button>
        </div>
      )}
      {sent && !verified && (
        <>
          <p className="why otp-note">{fill(t.otpSentTo, { phone: j.otp.phone })}</p>
          {demoCode && <p className="notice" role="status">{fill(t.otpDemoCode, { code: demoCode })}</p>}
          <label className="field-label" htmlFor="otp">{t.otp}</label>
          <div className="row">
            <input id="otp" className="mono" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoComplete="one-time-code" />
            <button className="ghost" disabled={code.length !== 6 || busy} onClick={() => otpAct('verify', { code })}>{t.verifyOtp}</button>
          </div>
          <button className="link small" disabled={busy} onClick={() => otpAct('send', { phone: phone || undefined })}>{t.resendOtp}</button>
        </>
      )}
      {verified && <p className="verified" role="status">✓ {t.otpVerified}</p>}
      {otpMessage && <p className="doc-issue" role="alert">{otpMessage}</p>}
      <span className="field-label">{t.visit}</span>
      <div className="chips">
        {[['morning', t.slotMorning], ['afternoon', t.slotAfternoon], ['evening', t.slotEvening]].map(([k, l]) => (
          <button key={k} className={`chip ${slot === k ? 'on' : ''}`} aria-pressed={slot === k} onClick={() => setSlot(k)}>{l}</button>
        ))}
      </div>
      <section className="due">
        <div><span>{t.dueNow}</span><strong>{rupees(due)}</strong></div>
        <p className="why">{t.payFirst}</p>
      </section>
      {err === 'payment_failed' && <p className="doc-issue" role="alert">{t.payFailed}</p>}
      {j.demoMode && <label className="check small"><input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} /><span>{t.payFailDemo}</span></label>}
      <button className="cta" disabled={!verified || busy} onClick={() => place({ slot, pay: fail ? 'fail' : 'ok' })}>{t.payUpi}</button>
    </main>
  );
}

const dateText = (d, lang) => new Date(d).toLocaleDateString('en-IN', lang === 'en' ? { day: 'numeric', month: 'short' } : { day: '2-digit', month: '2-digit', year: 'numeric' });

function TrackerView({ order, t, lang, onCall, called }) {
  return (
    <main className="page tracker">
      <span className="bill-kicker">{t.orderNo} {order.id}</span>
      <h1>{order.stageLabel}</h1>
      <p className="lede">{t.expected}: <strong>{dateText(order.eta, lang)}</strong></p>
      <ol className="timeline">
        {order.stages.map((s) => <li key={s.key} className={s.done ? 'done' : ''}>{s.label}</li>)}
      </ol>
      <h2>{t.items}</h2>
      <ul className="track-items">
        {order.items.map((i) => (
          <li key={i.id}>
            <div><strong>{i.name}</strong>{i.qty > 1 ? ` × ${i.qty}` : ''}<p className="why">{i.stageLabel}</p></div>
            <span className={`when ${i.stage === 'active' ? 'live' : ''}`}>{i.stage === 'active' ? '✓' : `${dateText(i.eta, lang)}`}</span>
          </li>
        ))}
      </ul>
      <p className="why">{t.savedLink}</p>
      {onCall && (
        <div className="links">
          {called ? <p className="notice">{t.callbackDone}</p> : <button className="link" onClick={onCall}>{t.needHelp} {t.requestCall}</button>}
        </div>
      )}
    </main>
  );
}

function TrackPage({ lang, setLang }) {
  const t = dict(lang);
  const q = new URLSearchParams(location.search);
  const [orderId, setOrderId] = useState(q.get('order') ?? '');
  const [phone, setPhone] = useState('');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(false);
  const [called, setCalled] = useState(false);
  const find = async (e) => {
    e.preventDefault();
    setErr(false);
    try { setRes(await api(`/track?orderId=${encodeURIComponent(orderId)}&phone=${encodeURIComponent(phone)}&lang=${lang}`)); }
    catch { setErr(true); }
  };
  return (
    <>
      <Header lang={lang} setLang={setLang} />
      {res ? (
        <TrackerView order={res.order} t={t} lang={lang} called={called} onCall={async () => { await api(`/journeys/${res.token}/callback`, { method: 'POST' }); setCalled(true); }} />
      ) : (
        <main className="page">
          <h1>{t.trackFind}</h1>
          <form onSubmit={find}>
            <label className="field-label" htmlFor="oid">{t.orderId}</label>
            <input id="oid" className="mono" value={orderId} onChange={(e) => setOrderId(e.target.value.toUpperCase())} placeholder="UD-A1B2C3" />
            <label className="field-label" htmlFor="ph">{t.mobile}</label>
            <input id="ph" inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} />
            {err && <p className="doc-issue" role="alert">{t.notFound}</p>}
            <button className="cta" disabled={!orderId || phone.length !== 10}>{t.find}</button>
          </form>
        </main>
      )}
    </>
  );
}

export default function App() {
  const path = location.pathname;
  const initialLang = (() => { try { return localStorage.getItem('udyam.lang') ?? 'hi'; } catch { return 'hi'; } })();
  const [lang, setLangState] = useState(initialLang);
  const [j, setJ] = useState(null);
  const [screen, setScreen] = useState('welcome');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [notice, setNotice] = useState(null);
  const t = dict(lang);
  const setLang = (l) => {
    setLangState(l);
    try { localStorage.setItem('udyam.lang', l); } catch {  }
    document.documentElement.lang = l;
    if (j?.token && j.lang !== l) api(`/journeys/${j.token}/lang`, { method: 'POST', body: { lang: l } }).then(setJ).catch(() => {});
  };
  useEffect(() => { document.documentElement.lang = lang; if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch(() => {}); }, [lang]);

  const [resumable, setResumable] = useState(false);
  useEffect(() => { if (store.get() && !['/track', '/ops'].includes(path)) setResumable(true); }, [path]);

  useEffect(() => {
    if (screen !== 'kyc' || j?.kyc?.verdict !== 'review') return undefined;
    const timer = setInterval(() => { api(`/journeys/${j.token}`).then(setJ).catch(() => {}); }, 5000);
    return () => clearInterval(timer);
  }, [screen, j?.token, j?.kyc?.verdict]);

  const screenFor = (v) => (v.order ? 'track' : v.status === 'kyc' ? 'kyc' : v.quote ? 'quote' : 'advice');

  const run = async (fn) => {
    setBusy(true); setErr(null);
    try { return await fn(); }
    catch (e) { setErr(e.code ?? 'generic'); return null; }
    finally { setBusy(false); }
  };

  const start = () => run(async () => {
    const source = new URLSearchParams(location.search).get('src') ?? 'Website form';
    const v = await api('/journeys', { method: 'POST', body: { lang, source } });
    store.set(v.token); setJ(v); setScreen('advice');
  });
  const resume = () => run(async () => {
    try {
      const v = await api(`/journeys/${store.get()}`);
      setJ(v); setLang(v.lang); setScreen(screenFor(v));
    } catch { store.clear(); setResumable(false); }
  });

  const send = (payload) => run(async () => {
    const shown = payload.label ?? payload.text;
    setJ((cur) => ({ ...cur, ui: null, messages: [...cur.messages, { from: 'owner', text: shown }] }));
    const v = await api(`/journeys/${j.token}/message`, { method: 'POST', body: payload });
    setJ(v);
  });

  const item = (id, on, qty) => run(async () => {
    setNotice(null);
    try {
      const v = await api(`/journeys/${j.token}/quote/item`, { method: 'POST', body: { id, on, qty } });
      setJ(v);
      const parts = [];
      if (v.change?.added?.length) parts.push(`${t.alsoAdded}: ${v.change.added.join(', ')}`);
      if (v.change?.removed?.length) parts.push(`${t.alsoRemoved}: ${v.change.removed.join(', ')}`);
      if (parts.length) setNotice(parts.join('. '));
    } catch (e) { if (e.data?.message) setNotice(e.data.message); else throw e; }
  });

  const callback = () => run(async () => {
    const v = await api(`/journeys/${j.token}/callback`, { method: 'POST' });
    setJ(v); setNotice(t.callbackDone);
  });

  const agree = (body) => run(async () => { setJ(await api(`/journeys/${j.token}/consent`, { method: 'POST', body })); setScreen('kyc'); });
  const [docBusy, setDocBusy] = useState(null);
  const kycAct = async (kind, body) => {
    setErr(null);
    setDocBusy(kind === 'specimen' ? 'specimen' : 'lookup');
    try {
      if (kind === 'withdraw') {
        const v = await api(`/journeys/${j.token}/consent/withdraw`, { method: 'POST' });
        setJ(v); setScreen('quote');
      } else setJ(await api(`/journeys/${j.token}/kyc/${kind}`, { method: 'POST', body }));
    } catch (e) { setErr(e.code); }
    setDocBusy(null);
  };
  const upload = async (type, file) => {
    setDocBusy(type); setErr(null);
    const form = new FormData();
    form.append('file', file);
    try { setJ(await api(`/journeys/${j.token}/kyc/documents/${type}`, { method: 'POST', body: form })); }
    catch (e) { setErr(e.code); }
    setDocBusy(null);
  };
  const [demoCode, setDemoCode] = useState(null);
  const otpAct = async (kind, body) => {
    setErr(null);
    try {
      const v = await api(`/journeys/${j.token}/otp/${kind}`, { method: 'POST', body: { phone: lastPhone.current, ...(body.phone ? { phone: body.phone } : {}), code: body.code } });
      if (kind === 'send') { lastPhone.current = body.phone ?? lastPhone.current; setDemoCode(v.demoCode ?? null); }
      setJ(v);
      return true;
    } catch (e) { setErr(e.code ?? 'generic'); return false; }
  };
  const lastPhone = useRef(null);
  const place = (body) => run(async () => {
    const v = await api(`/journeys/${j.token}/order`, { method: 'POST', body });
    setJ(v); setScreen('track');
  });

  if (path === '/ops') return <Ops />;
  if (path === '/track') return <TrackPage lang={lang} setLang={setLang} />;

  if (screen === 'welcome' || !j) {
    return (
      <>
        <Header lang={lang} setLang={setLang} />
        <Welcome lang={lang} setLang={setLang} onStart={start} onResume={resume} resumable={resumable} busy={busy} error={err} />
      </>
    );
  }

  const step = { advice: 'advice', quote: 'quote', consent: 'docs', kyc: 'docs', checkout: 'order', track: 'track' }[screen];
  return (
    <>
      <Header lang={lang} setLang={setLang} />
      <Steps current={step} t={t} />
      {screen === 'advice' && <Advisor j={j} send={send} busy={busy} t={t} goQuote={() => setScreen('quote')} />}
      {screen === 'quote' && j.quote && <Quote j={j} item={item} t={t} notice={notice} back={() => setScreen('advice')} callback={callback} next={() => setScreen(j.consentAt ? 'kyc' : 'consent')} />}
      {screen === 'consent' && <Consent t={t} agree={agree} busy={busy} />}
      {screen === 'kyc' && j.kyc && <Kyc j={j} t={t} act={kycAct} upload={upload} busy={docBusy} err={err} next={() => setScreen('checkout')} />}
      {screen === 'checkout' && <Checkout j={j} t={t} place={place} busy={busy} err={err} otpAct={otpAct} demoCode={demoCode} />}
      {screen === 'track' && j.order && <TrackerView order={j.order} t={t} lang={lang} called={Boolean(j.handoff)} onCall={callback} />}
    </>
  );
}
