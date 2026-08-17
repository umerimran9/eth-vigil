"""
The feature contract.

Every path into a BlockSOC model -- live ingest, CSV upload, replay, the
notebooks themselves -- must produce a matrix that satisfies this contract.
This module is deliberately dumb and dependency-light so it can be imported
from a notebook without dragging the serving stack along.

The single most likely source of silent wrongness in this system is a feature
matrix with the right 61 columns in the wrong order. Trees will happily score
it. The numbers will look plausible. They will be meaningless. Hence the
asserts.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

N_FEATURES = 61

# Fields that get RobustScaler applied to their era-relative form.
# This is deliberately restricted -- an unrestricted scale_cols was one of the
# systemic bugs in the notebook suite. Inert for tree models, real impact for
# LogisticRegression / MLP / Transformer.
SCALE_ERA_REL_FIELDS = ["gas_efficiency", "cumulative_gas_used"]

# Binary high-risk fields that use presence-masked era-relative treatment
# rather than the standard era-relative transform.
PRESENCE_MASKED_BINARY_FIELDS = [
    "erc_20_Symbol_End_Is_Digit",
    "erc_20_Name_Has_Digit",
]

# Guard against a division-by-zero blowup in rolling std.
ROLL_STD_EPSILON = 1e-6


class FeatureContractError(AssertionError):
    """Raised when a feature matrix violates the contract."""


def load_feature_order(path: str | Path) -> list[str]:
    """Load the canonical 61-name ordered feature list from feature_order.json."""
    data = json.loads(Path(path).read_text())
    if isinstance(data, dict) and "feature_order" in data:
        names = data["feature_order"]
    elif isinstance(data, list):
        names = data
    else:
        raise FeatureContractError("feature_order.json must contain a JSON list or dict with 'feature_order'")
    if len(names) != N_FEATURES:
        raise FeatureContractError(
            f"feature_order.json has {len(names)} names, expected {N_FEATURES}"
        )
    if len(set(names)) != len(names):
        dupes = sorted({n for n in names if names.count(n) > 1})
        raise FeatureContractError(f"feature_order.json has duplicate names: {dupes}")
    return names


def save_feature_order(names: list[str], path: str | Path) -> None:
    """Write the canonical feature order. Call this once, from the notebook."""
    if len(names) != N_FEATURES:
        raise FeatureContractError(
            f"refusing to save {len(names)} feature names, expected {N_FEATURES}"
        )
    Path(path).write_text(json.dumps(list(names), indent=2))


def validate_frame(df: pd.DataFrame, feature_order: list[str]) -> None:
    """
    Check a DataFrame against the contract. Raises on any violation.

    Checks, in the order they are most likely to bite:
      1. all 61 expected columns present
      2. no unexpected extra columns
      3. columns in exactly the canonical order
      4. all numeric
      5. no NaN / inf
    """
    cols = list(df.columns)

    missing = [c for c in feature_order if c not in cols]
    if missing:
        raise FeatureContractError(
            f"{len(missing)} expected feature(s) missing: {missing[:10]}"
            + (" ..." if len(missing) > 10 else "")
        )

    extra = [c for c in cols if c not in feature_order]
    if extra:
        raise FeatureContractError(
            f"{len(extra)} unexpected column(s) present: {extra[:10]}"
            + (" ..." if len(extra) > 10 else "")
        )

    if cols != feature_order:
        first_bad = next(
            i for i, (a, b) in enumerate(zip(cols, feature_order)) if a != b
        )
        raise FeatureContractError(
            "feature ORDER mismatch (same names, different order) -- "
            f"position {first_bad}: got {cols[first_bad]!r}, "
            f"expected {feature_order[first_bad]!r}"
        )

    non_numeric = [c for c in cols if not pd.api.types.is_numeric_dtype(df[c])]
    if non_numeric:
        raise FeatureContractError(f"non-numeric feature column(s): {non_numeric}")

    arr = df.to_numpy(dtype=np.float64, copy=False)
    if not np.isfinite(arr).all():
        bad_cols = [c for c in cols if not np.isfinite(df[c].to_numpy(np.float64)).all()]
        raise FeatureContractError(f"NaN or inf present in: {bad_cols[:10]}")


def to_matrix(df: pd.DataFrame, feature_order: list[str]) -> np.ndarray:
    """
    Validate and convert to the float32 matrix the models expect.

    Reorders defensively before validating, so an out-of-order frame from a
    caller is fixed rather than rejected -- but a frame with the wrong SET of
    columns still raises.
    """
    if set(df.columns) == set(feature_order) and list(df.columns) != feature_order:
        df = df[feature_order]
    validate_frame(df, feature_order)
    return df.to_numpy(dtype=np.float32, copy=True)
