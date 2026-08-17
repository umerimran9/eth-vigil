"""
The model-space transform.

Every Case C model was fit on a feature matrix that had already been through
two steps that the serving path was skipping entirely:

    1. np.log1p(x.clip(lower=0))  over 9 columns   (LOG_COLS)
    2. RobustScaler               over 16 columns  (SCALE_COLS)

Skipping them is not a small error. Measured on the shipped artifacts before
this module existed: the MLP returned exactly 1.0000 for every input, logistic
regression collapsed to a 0/1 step function, TabNet pinned at 0.0009, and a
5,000 ETH transfer scored identically to a 1.45 ETH one because both sit far
above every split threshold any tree ever learned. The models were not
detecting fraud; they were saturating.

PROVENANCE -- this is a move, not a reimplementation (CLAUDE.md rule 1).
The column lists and the transform below are copied from
`preprocessing_v2/02_train_val_test_splits.ipynb`, cell 3, function
`fit_transform_split`. The same recipe appears independently in
`tabular_models/case_comparison/case_c/tabnet/05_tabnet_optimized...ipynb` and
in `CSVs/production_model/config.json`'s `log_cols`/`scale_cols` keys -- three
sources, all agreeing, which is why these lists are hard-coded here rather
than read from a config that could drift.

Verified: applying `log_transform` then `scaler_wallet_grouped.pkl` to
`preprocessing_v2/data/unified_final_v7.csv` reproduces
`train_wallet_grouped.csv` digit-for-digit across every column checked
(gas_used, gas_efficiency, value, total_gas_cost, effective_gas_price,
cumulative_gas_used, length_to, length_log, gas_efficiency_era_rel).

WHICH SCALER GOES WITH WHICH MODEL is deliberately NOT decided here. A scaler
is only correct for the exact fold its paired model was fit on, and this
module refuses to guess: `ModelSpaceTransform` takes an explicit path, and
`blocksoc_serving/registry.py` names one per model.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Sequence

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# The column lists. Order matters for SCALE_COLS only in the sense that the
# fitted scaler carries its own `feature_names_in_`; we always align by NAME
# against that, never by position (see ModelSpaceTransform.__init__).
# ---------------------------------------------------------------------------

# preprocessing_v2/02 cell 3: RELATIVE_FIELDS
RELATIVE_FIELDS: list[str] = [
    "gas_used",
    "gas_efficiency",
    "cumulative_gas_used",
    "effective_gas_price",
    "total_gas_cost",
    "value",
]

# preprocessing_v2/02 cell 3: log_then_scale_cols
LOG_COLS: list[str] = RELATIVE_FIELDS + [
    "erc_20_TokenQuantity",
    "erc_721_TokenQuantity",
    "length_log",
]

# preprocessing_v2/02 cell 3: SCALE_ERA_REL_FIELDS. Deliberately only these
# two -- the notebook measured that scaling the other four era-relative
# columns a second time amplifies them (total_gas_cost_era_rel 1.2x,
# gas_used_era_rel 1.6x, effective_gas_price_era_rel 2.6x, value_era_rel
# 3.2x), because each field's fitted IQR is tiny next to the already-clipped
# +-10 range those columns carry. This mirrors the identical constant in
# schema.py, which CLAUDE.md guardrail 4 says not to widen.
SCALE_ERA_REL_FIELDS: list[str] = ["gas_efficiency", "cumulative_gas_used"]

# preprocessing_v2/02 cell 3: scale_only_cols
SCALE_ONLY_COLS: list[str] = [
    "gas_price_ratio",
    "erc_20_Log_Quantity",
    "erc_20_Log_Normalized_Quantity",
    "erc_721_Log_Quantity",
    "length_to",
] + [f"{f}_era_rel" for f in SCALE_ERA_REL_FIELDS]

# preprocessing_v2/02 cell 3: all_scale_cols
SCALE_COLS: list[str] = LOG_COLS + SCALE_ONLY_COLS

assert len(SCALE_COLS) == 16, f"expected 16 scale columns, got {len(SCALE_COLS)}"
assert len(set(SCALE_COLS)) == len(SCALE_COLS), "duplicate name in SCALE_COLS"


class TransformContractError(RuntimeError):
    """Raised when a scaler artifact does not fit the feature contract."""


def log_transform(df: pd.DataFrame) -> pd.DataFrame:
    """
    Step 1: `np.log1p(x.clip(lower=0))` over LOG_COLS.

    Copied from preprocessing_v2/02 cell 3:
        for c in log_then_scale_cols:
            Xtr[c] = np.log1p(Xtr[c].clip(lower=0))

    The `clip(lower=0)` is load-bearing, not defensive noise: several of these
    columns can legitimately go negative once era-relative work has touched
    them, and log1p of anything below -1 is NaN, which `schema.validate_frame`
    would then reject with a confusing "NaN present" message far from the
    real cause.

    Columns absent from `df` are skipped rather than created -- a caller
    passing a partial frame gets a partial transform, and the 61-column
    contract is enforced by schema.validate_frame, not here.
    """
    out = df.copy()
    for c in LOG_COLS:
        if c in out.columns:
            out[c] = np.log1p(out[c].astype(np.float64).clip(lower=0))
    return out


def is_model_space(df: pd.DataFrame, feature_order: Sequence[str]) -> bool:
    """
    Best-effort guess at whether `df` has ALREADY been through this transform.

    Needed because two different representations reach the scoring path: a
    raw transaction built by `builder.build_single_tx_features` (magnitudes
    like gas_used=21000, value=1.45e18), and an uploaded pre-engineered matrix
    such as `eth-vigil/public/demo/demo_batch_sample.csv`, which is a slice of
    `train_wallet_grouped.csv` and is therefore already log-and-scaled.
    Feeding the second one through the transform a second time is just as
    wrong as skipping it on the first.

    The test is a magnitude check, not a fingerprint. After log1p + RobustScaler
    every column in SCALE_COLS sits in roughly [-60, +11] on real data (the
    widest observed on the full v7 matrix was effective_gas_price at -58.6).
    Raw wei values are 1e9 and up. There is no plausible overlap, so a single
    threshold separates them cleanly.

    Returns True for "already model space". An empty frame returns True (there
    is nothing to transform, and claiming otherwise would double-log an empty
    result).
    """
    cols = [c for c in SCALE_COLS if c in df.columns and c in feature_order]
    if not cols or len(df) == 0:
        return True
    peak = float(np.nanmax(np.abs(df[cols].to_numpy(dtype=np.float64, na_value=0.0))))
    return peak < 1e6


class ModelSpaceTransform:
    """
    Wraps one fitted RobustScaler and applies the full two-step transform.

    Deliberately takes an explicit artifact path. A scaler is only valid for
    the exact training fold its paired model was fit on, and this class has no
    way to check that pairing -- the caller asserts it by naming the file.

    Alignment is by NAME against `scaler.feature_names_in_`, never by column
    position. If the scaler is ever swapped for one fit on a different column
    list, this keeps working; if it is swapped for one whose columns are not
    all in the feature contract, it raises at load time instead of silently
    scoring against a misaligned matrix.
    """

    def __init__(self, scaler_path: str | Path, feature_order: Sequence[str], name: str = ""):
        import joblib

        self.name = name or str(scaler_path)
        self.scaler_path = Path(scaler_path)
        if not self.scaler_path.exists():
            raise TransformContractError(f"{self.name}: scaler artifact not found at {self.scaler_path}")

        self.scaler: Any = joblib.load(self.scaler_path)
        names = list(getattr(self.scaler, "feature_names_in_", []))
        if not names:
            raise TransformContractError(
                f"{self.name}: {self.scaler_path.name} has no feature_names_in_, so its columns "
                "cannot be aligned by name. Refusing to guess a column order."
            )

        missing = [n for n in names if n not in feature_order]
        if missing:
            raise TransformContractError(
                f"{self.name}: {self.scaler_path.name} was fit on {len(missing)} column(s) that are "
                f"not in the 61-feature contract: {missing[:5]}"
            )

        self.scale_names: list[str] = names
        self.scale_indices: list[int] = [list(feature_order).index(n) for n in names]
        self.log_indices: list[int] = [
            list(feature_order).index(c) for c in LOG_COLS if c in feature_order
        ]

    def apply(self, X: np.ndarray) -> np.ndarray:
        """
        Transform a raw-space matrix (N x 61) into this model's input space.

        Operates on a copy -- several models share one matrix inside
        `ModelRegistry.predict_all`, and an in-place transform would leak one
        model's scaling into the next one's input.
        """
        out = X.astype(np.float64, copy=True)
        if self.log_indices:
            block = out[:, self.log_indices]
            np.clip(block, 0.0, None, out=block)
            out[:, self.log_indices] = np.log1p(block)
        out[:, self.scale_indices] = self.scaler.transform(out[:, self.scale_indices])
        return out.astype(np.float32, copy=False)

    def __repr__(self) -> str:
        return f"ModelSpaceTransform({self.scaler_path.name}, {len(self.scale_names)} scaled cols)"
