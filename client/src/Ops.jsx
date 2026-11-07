import { useEffect, useState } from 'react';

const REASON = {
  asked_for_person: 'Asked for a person', city_not_served: 'City not served yet', beyond_smb_size: 'Too large for self-serve',
  leased_line_survey: 'Leased line needs a site survey', kyc_review: 'KYC details disagree', kyc_blocked: 'GSTIN problem',
};
const OWNER = { partner: 'Channel partner', inside_sales: 'Inside sales', field_sales: 'Field sales', enterprise: 'Enterprise team', kyc_desk: 'KYC desk' };
const SETUP = { hotspot: 'Now on a mobile hotspot', home: 'Now on home broadband', business: 'Now on business broadband', leased: 'Now on a leased line', mixed: 'Different provider per site' };
const ISSUE = { legal_name_mismatch: 'Legal name differs from the registry', trade_name_mismatch: 'Trade name differs from the registry', gst_address_mismatch: 'Certificate address differs from the registry', address_mismatch: 'Bill address differs from the registered address', address_name_mismatch: 'Name on the bill differs', udyam_name_mismatch: 'Udyam name differs', udyam_state_mismatch: 'Udyam state differs', udyam_not_in_registry: 'Udyam number not on the registry', signatory_business_mismatch: 'Business on the ID differs', signatory_not_proprietor: 'Signatory is not the proprietor', gstin_state_mismatch: 'GSTIN state code differs' };
const SEGMENT = { micro: 'Micro retail', prof: 'Professional office', multi: 'Multi-site', mfg: 'Manufacturer' };
const FUNNEL = { started: 'Started', quoted: 'Saw a bill', consented: 'Gave consent', kyc_verified: 'KYC verified', ordered: 'Ordered' };

export default function Ops() {
  const [token, setToken] = useState(() => { try { return sessionStorage.getItem('udyam.ops') ?? ''; } catch { return ''; } });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const call = async (path, opts = {}) => {
    const res = await fetch(`/api/ops${path}`, { ...opts, headers: { 'x-ops-token': token, 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(res.status === 401 ? 'That password is not correct.' : 'The back office could not load. Try again.');
    return res.json();
  };
  const load = async () => {
    setError(null);
    try {
      const [h, m, o] = await Promise.all([call('/handoffs'), call('/metrics'), call('/orders')]);
      try { sessionStorage.setItem('udyam.ops', token); } catch {  }
      setData({ handoffs: h.rows, metrics: m, orders: o.rows });
    } catch (e) { setError(e.message); setData(null); }
  };
  useEffect(() => { if (token) load();  }, []);

  if (!data) {
    return (
      <main className="page ops-login">
        <h1>Back office</h1>
        <form onSubmit={(e) => { e.preventDefault(); load(); }}>
          <label className="field-label" htmlFor="tok">Password</label>
          <input id="tok" type="password" value={token} onChange={(e) => setToken(e.target.value)} />
          {error && <p className="doc-issue" role="alert">{error}</p>}
          <button className="cta" disabled={!token}>Open back office</button>
        </form>
      </main>
    );
  }

  return (
    <main className="ops">
      <h1>Leads the advisor could not close</h1>
      <p className="why">Highest chance of activating first. Each lead goes to the channel that costs least for its segment, based on Apr–Jun 2026 cost per activation.</p>
      {data.handoffs.length === 0 && <p className="notice">No open leads. They appear here when the advisor hands one over.</p>}
      <ul className="ops-list">
        {data.handoffs.map((h) => (
          <li key={h.token}>
            <div className="score" title="Propensity score, from the model trained on smb_leads.csv">{h.score}%</div>
            <div className="ops-main">
              <strong>{h.business}</strong> <span className="why">{h.city}{h.employees ? `, ${h.employees} people` : ''}{h.sites > 1 ? `, ${h.sites} sites` : ''}</span>
              <p>{REASON[h.reason] ?? h.reason}. <span className="why">{SEGMENT[h.segment] ?? ''}{SETUP[h.currentSetup] ? `. ${SETUP[h.currentSetup]}` : ''}</span></p>
              {h.issues?.map((i) => <p key={i.code} className="why">{ISSUE[i.code] ?? i.code}{i.onDocument ? `: "${i.onDocument}" on the document, "${i.onRegistry}" on the registry` : ''}</p>)}
            </div>
            <div className="ops-owner">
              <span>{OWNER[h.owner] ?? h.owner}</span>
              {h.reason === 'kyc_review' && <button className="ghost" onClick={async () => { await call(`/handoffs/${h.token}/approve-kyc`, { method: 'POST' }); load(); }}>Approve KYC</button>}
              <button className="link small" onClick={async () => { await call(`/handoffs/${h.token}/close`, { method: 'POST' }); load(); }}>Mark done</button>
            </div>
          </li>
        ))}
      </ul>

      <h2>Orders</h2>
      {data.orders.length === 0 && <p className="why">No orders yet.</p>}
      <ul className="ops-list">
        {data.orders.map((o) => (
          <li key={o.id}>
            <div className="ops-main">
              <strong>{o.id}</strong> <span className="why">{o.business}</span>
              <p className="why">{o.items.map((i) => `${i.name}: ${i.stage.replaceAll('_', ' ')}`).join('; ')}</p>
            </div>
            <div className="ops-owner">
              <button className="ghost" disabled={o.items.every((i) => i.stage === 'active')} onClick={async () => { await call(`/orders/${o.id}/advance`, { method: 'POST' }); load(); }}>Move forward</button>
            </div>
          </li>
        ))}
      </ul>

      <h2>This prototype's journeys</h2>
      <dl className="ops-metrics">
        {data.metrics.funnel.map((f) => <div key={f.key}><dt>{FUNNEL[f.key]}</dt><dd>{f.n}</dd></div>)}
        <div><dt>Median minutes to order</dt><dd>{data.metrics.medianMinutesToOrder ?? '-'}</dd></div>
        <div><dt>Tracker checks</dt><dd>{data.metrics.trackerViews}</dd></div>
      </dl>
    </main>
  );
}
