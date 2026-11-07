"""Trains the lead propensity score used in the back office. Run: python3 server/scripts/train_propensity.py
Uses only what is known before anyone calls. 5-fold cross-validated AUC is printed and saved."""
import json, os
import numpy as np, pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict
DATA = os.path.join(os.path.dirname(__file__), '..', 'data')
l = pd.read_csv(f'{DATA}/smb_leads.csv'); y = (l.outcome == 'Activated').astype(int)
X = pd.DataFrame({'log_spend': np.log1p(l.monthly_telecom_spend_inr), 'log_emp': np.log1p(l.employee_count), 'gst': (l.has_gstin == 'Y')*1, 'udyam': (l.has_udyam == 'Y')*1, 'tier1': (l.city_tier == 1)*1, 'regional': (~l.preferred_language.isin(['Hindi', 'English']))*1})
for s in ['Micro retail & services', 'Small multi-site businesses', 'Small manufacturers']: X['seg_'+s] = (l.segment == s)*1
for s in ['Website form', 'Channel partner', 'WhatsApp campaign', 'Referral', 'Inbound call']: X['src_'+s] = (l.lead_source == s)*1
cols = ['log_spend', 'log_emp']; mean, std = X[cols].mean(), X[cols].std(); X[cols] = (X[cols]-mean)/std
model = LogisticRegression(C=1, max_iter=2000)
p = cross_val_predict(model, X, y, cv=StratifiedKFold(5, shuffle=True, random_state=7), method='predict_proba')[:, 1]
order = np.argsort(-p); n = len(p); model.fit(X, y)
res = {'intercept': float(model.intercept_[0]), 'coef': dict(zip(X.columns, map(float, model.coef_[0]))), 'scale': {'mean': mean.to_dict(), 'std': std.to_dict()}, 'cv_auc': float(roc_auc_score(y, p)), 'top_decile_conv': float(y.values[order[:n//10]].mean()), 'top30_capture': float(y.values[order[:int(n*.3)]].sum()/y.sum())}
json.dump(res, open(f'{DATA}/propensity.json', 'w'), indent=1)
print({k: round(v, 3) for k, v in res.items() if k.startswith(('cv', 'top'))})
