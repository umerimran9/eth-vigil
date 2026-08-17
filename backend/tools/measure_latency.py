#!/usr/bin/env python3
"""
Measure real single-transaction inference latency per model.

The frontend has been showing latency figures (1.8 ms, 12.0 ms, ...) that
appear in no CSV anywhere in the repo -- the last unsourced numbers on the
page. This replaces them with measurements.

Method: p50 over N single-row predict_proba calls after a warm-up, on the
61-feature vector the serving path actually produces. Reports p50/p90 because
a p50 alone hides the tail that an analyst waiting on a verdict actually feels.
Model load time is excluded -- that is startup cost, paid once, not per
transaction.

Measured on CPU. GPU figures would be lower for the three neural models and
are not what this deployment runs on.
"""
from __future__ import annotations

import json
import sys
import time
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import joblib
import numpy as np

from blocksoc_features.schema import load_feature_order

N_WARMUP, N_RUNS = 20, 200
CASE_C = ROOT / "tabular_models" / "case_comparison" / "case_c"
WF = ROOT / "CSVs" / "wf_decile9"

fo = load_feature_order(ROOT / "blocksoc_features" / "feature_order.json")
rng = np.random.default_rng(42)
X = rng.normal(0, 1, size=(1, len(fo))).astype(np.float32)

CAT = [0, 4, 6, 9, 10, 12, 14, 15, 16, 17, 18, 20, 21, 22, 23, 24, 25,
       29, 30, 31, 40, 41, 42, 43, 44, 45, 46, 49]


def timeit(fn) -> tuple[float, float]:
    for _ in range(N_WARMUP):
        fn()
    ts = []
    for _ in range(N_RUNS):
        t0 = time.perf_counter()
        fn()
        ts.append((time.perf_counter() - t0) * 1000.0)
    a = np.array(ts)
    return float(np.percentile(a, 50)), float(np.percentile(a, 90))


results: dict[str, tuple[float, float]] = {}

# --- sklearn / boosted trees -------------------------------------------------
for mid, fname in [("xgboost", "model_xgboost_wfdecile9.pkl"),
                   ("lightgbm", "model_lightgbm_wfdecile9.pkl"),
                   ("random_forest", "model_random_forest_wfdecile9.pkl"),
                   ("logistic_regression", "model_logistic_regression_wfdecile9.pkl")]:
    p = WF / fname
    if not p.exists():
        print(f"  {mid}: artifact missing ({fname})"); continue
    m = joblib.load(p)
    results[mid] = timeit(lambda m=m: m.predict_proba(X))

# --- TabNet ------------------------------------------------------------------
try:
    from pytorch_tabnet.tab_model import TabNetClassifier
    cand = list((CASE_C / "tabnet").glob("**/model_tabnet_wfdecile9.zip"))
    if cand:
        tb = TabNetClassifier(); tb.load_model(str(cand[0]))
        Xt = X.copy()
        for c in (getattr(tb, "cat_idxs", None) or CAT):
            if c < Xt.shape[1]:
                Xt[:, c] = np.clip(np.nan_to_num(Xt[:, c]), 0, 1)
        results["tabnet"] = timeit(lambda: tb.predict_proba(Xt))
    else:
        print("  tabnet: artifact not found")
except Exception as e:
    print(f"  tabnet: {type(e).__name__}: {str(e)[:70]}")

# --- torch models ------------------------------------------------------------
try:
    import torch
    import torch.nn as nn
    torch.set_num_threads(1)          # match the serving process, keep it comparable

    class TabularMLP(nn.Module):
        def __init__(self, d=61):
            super().__init__()
            self.net = nn.Sequential(
                nn.Linear(d, 256), nn.BatchNorm1d(256), nn.GELU(), nn.Dropout(0.2),
                nn.Linear(256, 128), nn.BatchNorm1d(128), nn.GELU(), nn.Dropout(0.2),
                nn.Linear(128, 64), nn.BatchNorm1d(64), nn.GELU(), nn.Dropout(0.1),
                nn.Linear(64, 1))
        def forward(self, x): return self.net(x)

    mp = list((CASE_C / "mlp").glob("**/model_mlp_wfdecile9.pt")) or \
         list((CASE_C / "mlp").glob("**/mlp_wf_decile9_model.pt"))
    if mp:
        sd = torch.load(mp[0], map_location="cpu")
        mlp = TabularMLP(len(fo))
        mlp.load_state_dict(sd if isinstance(sd, dict) else sd.state_dict())
        mlp.eval()
        xt = torch.from_numpy(X)
        def run_mlp():
            with torch.no_grad():
                torch.sigmoid(mlp(xt))
        results["mlp"] = timeit(run_mlp)
    else:
        print("  mlp: artifact not found")
except Exception as e:
    print(f"  mlp: {type(e).__name__}: {str(e)[:90]}")

try:
    tp = list((CASE_C / "transformer").glob("**/model_transformer_wfdecile9.pt"))
    if tp:
        sd = torch.load(tp[0], map_location="cpu")
        # Infer geometry from the checkpoint rather than assuming it.
        d_token = sd["cls_token"].shape[-1]
        n_num = sd["numerical_tokenizer.weight"].shape[0]
        n_cat = len({k.split(".")[1] for k in sd if k.startswith("categorical_embeddings.")})
        n_layers = len({k.split(".")[2] for k in sd if k.startswith("encoder.layers.")})

        class NumTok(nn.Module):
            def __init__(s, n, d):
                super().__init__(); s.weight = nn.Parameter(torch.randn(n, d)); s.bias = nn.Parameter(torch.zeros(n, d))
            def forward(s, x): return x.unsqueeze(-1) * s.weight + s.bias

        class FTT(nn.Module):
            def __init__(s, n_num, n_cat, d, L):
                super().__init__()
                s.cls_token = nn.Parameter(torch.randn(1, 1, d))
                s.numerical_tokenizer = NumTok(n_num, d)
                s.categorical_embeddings = nn.ModuleList([nn.Embedding(2, d) for _ in range(n_cat)])
                lay = nn.TransformerEncoderLayer(d_model=d, nhead=2, dim_feedforward=64,
                                                 batch_first=True, activation="gelu")
                s.encoder = nn.TransformerEncoder(lay, num_layers=L)
                s.head = nn.Linear(d, 1)
            def forward(s, xn, xc):
                t = [s.cls_token.expand(xn.size(0), -1, -1), s.numerical_tokenizer(xn)]
                t += [e(xc[:, i]).unsqueeze(1) for i, e in enumerate(s.categorical_embeddings)]
                return s.head(s.encoder(torch.cat(t, 1))[:, 0])

        ft = FTT(n_num, n_cat, d_token, n_layers)
        ft.load_state_dict(sd, strict=False)
        ft.eval()
        num_idx = [i for i in range(len(fo)) if i not in CAT][:n_num]
        xn = torch.from_numpy(X[:, num_idx])
        xc = torch.from_numpy(np.clip(np.nan_to_num(X[:, CAT[:n_cat]]), 0, 1).astype(np.int64))
        def run_ft():
            with torch.no_grad():
                torch.sigmoid(ft(xn, xc))
        results["transformer"] = timeit(run_ft)
    else:
        print("  transformer: artifact not found")
except Exception as e:
    print(f"  transformer: {type(e).__name__}: {str(e)[:90]}")

print(f"\nSingle-transaction inference, CPU, 1 thread, p50 over {N_RUNS} runs\n")
print(f"{'model':<22}{'p50 (ms)':>10}{'p90 (ms)':>10}")
for k, (p50, p90) in sorted(results.items(), key=lambda x: x[1][0]):
    print(f"{k:<22}{p50:>10.2f}{p90:>10.2f}")

out = ROOT / "CSVs" / "wf_decile9" / "latency_ms.json"
out.write_text(json.dumps(
    {k: {"p50_ms": round(v[0], 2), "p90_ms": round(v[1], 2)} for k, v in results.items()},
    indent=2))
print(f"\nwritten -> {out}")
