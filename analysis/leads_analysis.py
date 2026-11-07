"""Every number in the business case comes from this script. Run: python3 analysis/leads_analysis.py
Facts come straight from the data pack. The impact estimate uses recovery rates that are ASSUMPTIONS,
listed in RECOVERY below, because the data cannot say how many lost leads a new journey would win back."""
import json, os
import pandas as pd

D = os.path.join(os.path.dirname(__file__), '..', 'server', 'data')
l = pd.read_csv(f'{D}/smb_leads.csv'); c = pd.read_csv(f'{D}/product_catalogue.csv').set_index('product_id'); g = pd.read_csv(f'{D}/mock_gstin_registry.csv')
l['act'] = l.outcome == 'Activated'
a = l[l.act].copy(); a['ch'] = a.churned_within_6_months == 'Y'
out = {}
ORDER = ['Lead', 'Contacted', 'Needs assessed', 'Quote accepted', 'KYC complete', 'Activated']
rank = {s: i for i, s in enumerate(ORDER)}; l['r'] = l.stage_reached.map(rank)

out['total_cac_spend'] = int(l.acquisition_cost_inr.sum()); out['cac_blended'] = round(l.acquisition_cost_inr.sum() / len(a))
out['conv'] = round(len(a) / len(l) * 100, 1); out['mrr'] = int(a.monthly_bundle_value_inr.sum()); out['churn'] = round(a.ch.mean() * 100, 1); out['nps'] = round(a.nps_score.mean(), 1)

seg = {}
for s, x in l.groupby('segment'):
    y = x[x.act]
    seg[s] = dict(leads=len(x), share_leads=round(len(x)/len(l)*100), activated=len(y), conv=round(len(y)/len(x)*100, 1), cac=round(x.acquisition_cost_inr.sum()/len(y)),
                  arpu=round(y.monthly_bundle_value_inr.mean()), median=int(y.monthly_bundle_value_inr.median()), churn=round((y.churned_within_6_months == 'Y').mean()*100, 1),
                  spend_share=round(x.acquisition_cost_inr.sum()/l.acquisition_cost_inr.sum()*100), mrr_share=round(y.monthly_bundle_value_inr.sum()/a.monthly_bundle_value_inr.sum()*100),
                  payback=round(x.acquisition_cost_inr.sum()/y.monthly_bundle_value_inr.sum(), 1), quote_accept=round((x.r >= 3).sum()/(x.r >= 2).sum()*100), kyc_pass=round((x.r >= 4).sum()/(x.r >= 3).sum()*100), days=round(y.days_lead_to_activation.mean(), 1), contract=round(y.contract_months.mean(), 1))
out['segments'] = seg

chan = {}
for (s, src), x in l.groupby(['segment', 'lead_source']):
    chan.setdefault(s, {})[src] = dict(leads=len(x), conv=round(x.act.mean()*100, 1), cac=round(x.acquisition_cost_inr.sum()/max(1, x.act.sum())), spend=int(x.acquisition_cost_inr.sum()), act=int(x.act.sum()))
out['channel_by_segment'] = chan
src = {}
for s, x in l.groupby('lead_source'):
    y = x[x.act]
    src[s] = dict(leads=len(x), conv=round(x.act.mean()*100, 1), cac=round(x.acquisition_cost_inr.sum()/len(y)), contacted=round((x.r >= 1).mean()*100), churn=round((y.churned_within_6_months == 'Y').mean()*100, 1))
out['sources'] = src
dig = l[l.lead_source.isin(['Website form', 'WhatsApp campaign'])]
out['digital_leads'] = len(dig); out['digital_never_contacted'] = int((dig.r == 0).sum()); out['digital_never_contacted_pct'] = round((dig.r == 0).mean()*100)
out['drop_reasons'] = l.drop_reason.value_counts().to_dict()
out['gst'] = {k: dict(leads=len(x), conv=round(x.act.mean()*100, 1), quote_accepted=int((x.r >= 3).sum()), kyc=int((x.r >= 4).sum()), kyc_pass=round((x.r >= 4).sum()/(x.r >= 3).sum()*100)) for k, x in l.groupby('has_gstin')}
out['udyam_none_share'] = round((l.has_udyam == 'N').mean()*100)
out['churn_by_calls'] = {int(k): dict(n=len(x), churn=round(x.ch.mean()*100, 1), nps=round(x.nps_score.mean(), 1)) for k, x in a.groupby('customer_follow_up_calls')}
low = a[a.customer_follow_up_calls <= 2]; hi = a[a.customer_follow_up_calls >= 4]
out['churn_calls_low'] = round(low.ch.mean()*100, 1); out['churn_calls_high'] = round(hi.ch.mean()*100, 1); out['nps_calls_low'] = round(low.nps_score.mean(), 1); out['nps_calls_high'] = round(hi.nps_score.mean(), 1)
slow = a[a.days_lead_to_activation > 21]; fast = a[a.days_lead_to_activation <= 21]
out['nps_slow'] = round(slow.nps_score.mean(), 1); out['nps_fast'] = round(fast.nps_score.mean(), 1); out['slow_n'] = len(slow)
l['reg'] = ~l.preferred_language.isin(['Hindi', 'English'])
out['language'] = dict(top3_share=round(l.preferred_language.isin(['Hindi', 'English', 'Marathi']).mean()*100), regional_conv=round(l[l.reg].act.mean()*100, 1), hi_en_conv=round(l[~l.reg].act.mean()*100, 1), regional_quote=round((l[l.reg].r >= 3).sum()/(l[l.reg].r >= 2).sum()*100), hi_en_quote=round((l[~l.reg].r >= 3).sum()/(l[~l.reg].r >= 2).sum()*100))

viol = {}; bad_leads = set()
for _, r in a.iterrows():
    it = [p.split('x')[0] for p in r.bundle_products.split(';')]
    for i in it:
        s = c.loc[i]; codes = []
        if s.requires_gstin == 'Y' and r.has_gstin != 'Y': codes.append('no_gstin')
        if r.employee_count < s.min_employees: codes.append('too_small')
        if r.num_sites < s.min_sites: codes.append('too_few_sites')
        if str(r.city_tier) not in str(s.available_city_tiers).split(';'): codes.append('wrong_city')
        if isinstance(s.requires_one_of, str) and not set(s.requires_one_of.split('|')) & set(it): codes.append('missing_dependency')
        for k in codes: viol[k] = viol.get(k, 0)+1; bad_leads.add(r.lead_id)
out['rule_breaks'] = viol; out['rule_break_customers'] = len(bad_leads)
m = a.merge(g, on='gstin'); out['activated_dead_gstin'] = {k: int(v) for k, v in m[m.status != 'Active'].status.value_counts().items()}
out['registry_status'] = g.status.value_counts().to_dict()

RECOVERY = {
    'Owner had no time for a visit': .50, 'Visit not scheduled by sales': .50,
    'Quote too complex to understand': .50, 'Quote took too long to arrive': .50,
    'Only wanted a mobile plan': .30,
    'Missing GST or Udyam document': .40, 'Found paperwork too long': .40, 'Document details did not match': .40, 'Authorised signatory not available': .25,
    'Installation delayed beyond 21 days': .25, 'Site not feasible for fibre': .50, 'Price too high': .10,
}
DIGITAL_UNREACHED = .25
survive = {i: (l.r >= 5).sum()/(l.r >= i).sum() for i in range(0, 6)}
won = []
for reason, rate in RECOVERY.items():
    x = l[l.drop_reason == reason]
    won.append(dict(reason=reason, lost=len(x), rate=rate, recovered_active=sum(rate*survive[int(i)+1] for i in x.r)))
x = dig[dig.drop_reason.isin(['Unreachable after 3 attempts', 'Wrong or invalid number'])]
won.append(dict(reason='Digital leads never reached', lost=len(x), rate=DIGITAL_UNREACHED, recovered_active=len(x)*DIGITAL_UNREACHED*survive[1]))
extra = sum(w['recovered_active'] for w in won)
dead = sum(out['activated_dead_gstin'].values())
new_act = len(a) + extra - dead
out['impact_lines'] = [{**w, 'recovered_active': round(w['recovered_active'], 1)} for w in won]
out['new_activations'] = round(new_act); out['new_conv'] = round(new_act/len(l)*100, 1)
ratio = 720/4030; new_spend = l.acquisition_cost_inr.astype(float).copy()
f = l.lead_source == 'Field sales'
new_spend[f & l.segment.str.startswith('Micro')] *= ratio
new_spend[f & l.segment.str.startswith('Professional')] *= (1+ratio)/2
RUN_COST_PER_LEAD = 25
total = new_spend.sum() + RUN_COST_PER_LEAD*len(l)
out['new_spend'] = round(total); out['new_cac'] = round(total/new_act); out['spend_saved'] = round(l.acquisition_cost_inr.sum()-total)
half_act = len(a) + extra/2 - dead
out['half_activations'] = round(half_act); out['half_conv'] = round(half_act/len(l)*100, 1); out['half_cac'] = round(total/half_act)
reason_groups = {'Visit never happened': ['Owner had no time for a visit', 'Visit not scheduled by sales'], 'Quote slow or confusing': ['Quote too complex to understand', 'Quote took too long to arrive'], 'Only wanted a mobile plan': ['Only wanted a mobile plan'], 'Paperwork': ['Missing GST or Udyam document', 'Found paperwork too long', 'Document details did not match', 'Authorised signatory not available'], 'Install late or site not feasible': ['Installation delayed beyond 21 days', 'Site not feasible for fibre']}
vc = l.drop_reason.value_counts()
out['process_groups'] = {k: int(sum(vc[r] for r in v)) for k, v in reason_groups.items()}
out['process_total'] = sum(out['process_groups'].values()); out['dropped_total'] = int((~l.act).sum()); out['process_share'] = round(out['process_total']/out['dropped_total']*100)
out['p10_in_multi'] = round(a[a.segment.str.startswith('Small multi')].bundle_products.str.contains('P10').mean()*100)
top = lambda col: {str(k): round(v*100, 1) for k, v in l.groupby(col).act.mean().items()}
out['conv_by_provider'] = top('current_provider'); out['accel_share_leads'] = round(l.current_provider.str.startswith('Accel').mean()*100)
out['accel_conv'] = round(l[l.current_provider.str.startswith('Accel')].act.mean()*100, 1); out['nonaccel_conv'] = round(l[~l.current_provider.str.startswith('Accel')].act.mean()*100, 1)
out['conv_by_turnover'] = top('annual_turnover_band')
t = {k: round((x.r >= 5).sum()/(x.r >= 4).sum()*100) for k, x in l.groupby('city_tier')}; out['kyc_to_active_by_tier'] = {str(k): v for k, v in t.items()}
out['conv_by_tier'] = top('city_tier')
out['churn_by_internet'] = {k: round(x.ch.mean()*100) for k, x in a.groupby('current_internet')}
q = l[l.r >= 2]; out['quote_by_language'] = {k: round((x.r >= 3).mean()*100) for k, x in q.groupby('preferred_language')}
out['micro_churn_by_calls'] = {int(k): round(x.ch.mean()*100) for k, x in a[a.segment.str.startswith('Micro')].groupby('customer_follow_up_calls')}
out['new_mrr_estimate'] = round(new_act*a.monthly_bundle_value_inr.median())
json.dump(out, open(os.path.join(os.path.dirname(__file__), 'results.json'), 'w'), indent=1, ensure_ascii=False, default=str)
for k in ['accel_share_leads','accel_conv','nonaccel_conv','conv_by_turnover','kyc_to_active_by_tier','conv_by_tier','churn_by_internet','quote_by_language','half_activations','half_conv','half_cac','process_groups','process_total','dropped_total','process_share','p10_in_multi','conv','cac_blended','mrr','churn','nps','gst','rule_breaks','rule_break_customers','activated_dead_gstin','churn_calls_low','churn_calls_high','nps_calls_low','nps_calls_high','nps_slow','nps_fast','slow_n','language','digital_leads','digital_never_contacted','digital_never_contacted_pct','new_activations','new_conv','new_spend','new_cac','spend_saved']: print(k, out[k])
for s,v in seg.items(): print(s,v)
for w in out['impact_lines']: print(w)
