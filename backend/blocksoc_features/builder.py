"""
Raw transaction -> 61-feature vector.

THIS FILE IS A SKELETON. The function bodies marked PORT must be filled in by
moving the corresponding logic out of preprocessing_v2/01. Do not rewrite that
logic from memory or from the paper -- copy it, then delete it from the
notebook and have the notebook import from here. Two implementations of the
same feature will diverge, and you will find out during your viva.

Everything already written below is a guardrail derived from bugs that were
found and fixed in that notebook. Keep them.

Port order (each one is independently testable against the notebook):
    1. build_static_features   -- pure per-row arithmetic, no state
    2. build_token_features    -- needs ERC-20 metadata, cacheable
    3. build_rolling_features  -- needs per-wallet history
    4. build_era_relative      -- needs frozen era stats
    5. apply_scaling           -- already written; verify against notebook
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Sequence

import numpy as np
import pandas as pd

from .schema import (
    PRESENCE_MASKED_BINARY_FIELDS,
    ROLL_STD_EPSILON,
    SCALE_ERA_REL_FIELDS,
)


@dataclass
class RawTransaction:
    """
    A normalised transaction, as produced by the ingest worker or read from an
    uploaded CSV. Deliberately close to what an Ethereum receipt gives you.
    """

    tx_hash: str
    block_number: int
    block_timestamp: int
    from_address: str
    to_address: str | None
    value: int
    gas: int
    gas_used: int
    gas_price: int
    cumulative_gas_used: int
    nonce: int
    input_data: str = "0x"
    # populated from decoded Transfer logs, one entry per token movement
    erc20_transfers: list[dict[str, Any]] | None = None


# ----------------------------------------------------------------------------
# ----------------------------------------------------------------------------
# 1. static per-row features
# ----------------------------------------------------------------------------


def build_static_features(df: pd.DataFrame) -> pd.DataFrame:
    """Per-row arithmetic features that require no historical state."""
    out = pd.DataFrame(index=df.index)

    to_addr = df["to_address"].fillna("").astype(str)
    out["length_to"] = to_addr.str.len().astype(np.float32)
    out["gas_used"] = df["gas_used"].astype(np.float32)

    gas_denom = df["gas"].replace(0, 1).astype(np.float32)
    out["gas_efficiency"] = (df["gas_used"].astype(np.float32) / gas_denom).astype(np.float32)

    out["value"] = df["value"].astype(np.float32)
    out["chain_id"] = df.get("chain_id", pd.Series(1, index=df.index)).astype(np.float32)

    gas_price = df.get("effective_gas_price", df.get("gas_price", pd.Series(0, index=df.index))).astype(np.float32)
    out["total_gas_cost"] = (df["gas_used"].astype(np.float32) * gas_price).astype(np.float32)

    # Event activity flag (1.0 if transaction logs exist or token transfers attached)
    if "erc20_transfers" in df.columns:
        has_transfers = df["erc20_transfers"].apply(lambda x: len(x) > 0 if isinstance(x, list) else False)
        out["event_activity_flag"] = has_transfers.astype(np.float32)
    else:
        out["event_activity_flag"] = np.float32(0.0)

    out["effective_gas_price"] = gas_price
    out["cumulative_gas_used"] = df.get("cumulative_gas_used", pd.Series(0, index=df.index)).astype(np.float32)

    from_addr = df["from_address"].fillna("").astype(str).str.lower()
    to_addr_lower = to_addr.str.lower()
    out["is_same_address"] = (from_addr == to_addr_lower).astype(np.float32)

    base_fee = df.get("block_base_fee", gas_price.replace(0, 1)).astype(np.float32)
    out["gas_price_ratio"] = (gas_price / base_fee.replace(0, 1)).astype(np.float32)

    input_data = df.get("input_data", pd.Series("0x", index=df.index)).fillna("0x").astype(str)
    out["length_log"] = input_data.str.len().astype(np.float32)

    err_flag = df.get("is_error", df.get("Error!", pd.Series(0, index=df.index)))
    if err_flag.dtype == object:
        out["Error!"] = (err_flag == "One or more errors occurred.").astype(np.float32)
    else:
        out["Error!"] = err_flag.astype(np.float32)

    return out


# ----------------------------------------------------------------------------
# 2. ERC-20 token metadata features
# ----------------------------------------------------------------------------


def _calc_entropy(s: str) -> float:
    if not s:
        return 0.0
    prob = [float(s.count(c)) / len(s) for c in set(s)]
    return float(-sum(p * np.log2(p) for p in prob))


def build_token_features(
    df: pd.DataFrame, token_metadata: pd.DataFrame
) -> pd.DataFrame:
    """
    Build all 40 ERC-20 and ERC-721 token metadata and lexical features.

    token_metadata (when non-empty) takes priority -- it's the live per-wallet
    lookup result from token_lookup.get_wallet_token_features(), one row,
    broadcast across every row of df (token holdings are wallet-constant, not
    per-transaction; see CLAUDE.md rule 6). Falls back to df's own columns
    (the pre-2026-08-09 behaviour, still needed for replay_dataset.py/batch
    CSV rows that already carry real erc_20_*/erc_721_* columns from the
    dataset), then to 0.0/0 if neither source has the column.
    """
    out = pd.DataFrame(index=df.index)

    # Defaults for all ERC-20 and ERC-721 fields
    erc20_cols = [
        "erc_20_Name_Uppercase_Ratio", "erc_20_Symbol_Is_Uppercase", "erc_20_Name_Contains_Token",
        "erc_20_Symbol_Contains_XYZ", "erc_20_Symbol_Starts_With_X", "erc_20_Name_Starts_With_The",
        "erc_20_Name_Num_Words", "erc_20_Name_Is_Alnum", "erc_20_Symbol_Is_Alnum", "erc_20_Name_Has_Digit",
        "erc_20_Symbol_Same_As_Name", "erc_20_Symbol_End_Is_Digit", "erc_20_Symbol_All_Same_Char",
        "erc_20_TokenQuantity", "erc_20_Log_Quantity", "erc_20_Log_Normalized_Quantity",
        "erc_20_Is_Zero_Divisor", "erc_20_Decimals_Above_10", "erc_20_Quantity_Is_Int",
        "erc_20_Unique_Chars_Name", "erc_20_Unique_Chars_Symbol", "erc_20_Name_Lowercase_Count",
        "erc_20_Symbol_Lowercase_Count", "erc_20_Name_Num_Uppercase", "erc_20_Symbol_Num_Uppercase",
        "erc_20_Symbol_Entropy"
    ]

    erc721_cols = [
        "erc_721_Name_Uppercase_Ratio", "erc_721_Symbol_Is_Uppercase", "erc_721_Name_Contains_Token",
        "erc_721_Symbol_Contains_XYZ", "erc_721_Symbol_Has_Special", "erc_721_Name_Is_Alnum",
        "erc_721_Name_Has_Digit", "erc_721_Symbol_Has_Digit", "erc_721_TokenQuantity",
        "erc_721_Log_Quantity", "erc_721_Is_Zero_Divisor", "erc_721_Name_Num_Uppercase",
        "erc_721_Name_Entropy", "erc_721_Symbol_Entropy"
    ]

    has_metadata = token_metadata is not None and not token_metadata.empty
    metadata_row = token_metadata.iloc[0] if has_metadata else None

    for col in erc20_cols + erc721_cols:
        if has_metadata and col in token_metadata.columns:
            out[col] = np.float32(metadata_row[col])
        elif col in df.columns:
            out[col] = df[col].astype(np.float32)
        else:
            out[col] = np.float32(0.0)

    return out


# ----------------------------------------------------------------------------
# 3. rolling / per-wallet history features
# ----------------------------------------------------------------------------


def build_rolling_features(
    df: pd.DataFrame, wallet_history: pd.DataFrame, window: int
) -> pd.DataFrame:
    """Build trailing per-wallet history features with epsilon std guard."""
    out = pd.DataFrame(index=df.index)
    return out


def guard_rolling_std(series: pd.Series) -> pd.Series:
    """The epsilon guard, isolated so it is impossible to forget."""
    return series.replace(0, ROLL_STD_EPSILON)


# ----------------------------------------------------------------------------
# 4. era-relative features
# ----------------------------------------------------------------------------


def build_era_relative(df: pd.DataFrame, era_stats: pd.DataFrame) -> pd.DataFrame:
    """Compute era-relative z-scores against frozen baseline stats."""
    out = df.copy()

    relative_fields = [
        "gas_used", "gas_efficiency", "cumulative_gas_used",
        "effective_gas_price", "total_gas_cost", "value",
    ]

    # Baseline stats snapshot
    stats_dict = era_stats.to_dict() if hasattr(era_stats, "to_dict") else {}

    for field in relative_fields:
        rel_col = f"{field}_era_rel"
        if rel_col in df.columns:
            continue

        if field in df.columns:
            val = np.log1p(np.maximum(df[field].astype(np.float64), 0.0))
            med = stats_dict.get(field, {}).get("median", val.median())
            std = stats_dict.get(field, {}).get("std", val.std())
            if std == 0 or np.isnan(std):
                std = 1.0
            z_score = (val - med) / std
            out[rel_col] = np.clip(z_score, -10.0, 10.0).astype(np.float32)
        else:
            out[rel_col] = np.float32(0.0)

    # Presence-masked binary era-relative fields
    for field in PRESENCE_MASKED_BINARY_FIELDS:
        rel_col = f"{field}_era_rel"
        if rel_col in df.columns:
            continue
        if field in df.columns:
            mask = df.get("erc_20_Name_Length", pd.Series(1, index=df.index)) > 0
            val = df[field].astype(np.float64)
            med = stats_dict.get(field, {}).get("median", val[mask].mean() if mask.any() else 0.0)
            z_score = np.where(mask, val - med, 0.0)
            out[rel_col] = np.clip(z_score, -1.0, 1.0).astype(np.float32)
        else:
            out[rel_col] = np.float32(0.0)

    return out


# ----------------------------------------------------------------------------
# 5. scaling
# ----------------------------------------------------------------------------


def apply_scaling(
    df: pd.DataFrame, scaler: Any, scale_fields: Sequence[str] = SCALE_ERA_REL_FIELDS
) -> pd.DataFrame:
    """
    Apply the fitted RobustScaler to the restricted field set only.

    An unrestricted scale_cols was one of the systemic bugs in the notebook
    suite -- inert for tree models, materially wrong for LogisticRegression,
    MLP and Transformer. The restriction is the fix, and it is hard-coded here
    rather than passed in from a config so it cannot drift again.
    """
    present = [c for c in scale_fields if c in df.columns]
    if not present:
        return df
    out = df.copy()
    out[present] = scaler.transform(out[present])
    return out


@lru_cache(maxsize=1)
def _load_era_stats_cached() -> pd.DataFrame:
    """Read and parse the frozen era baseline exactly once per process."""
    import json
    from pathlib import Path

    base_dir = Path(__file__).resolve().parent.parent
    path = base_dir / "CSVs" / "production_model" / "era_relative_baseline.json"
    if path.exists():
        data = json.loads(path.read_text())
        return pd.DataFrame(data)
    return pd.DataFrame()


def load_era_stats() -> pd.DataFrame:
    """
    Load baseline era statistics snapshot.

    Cached, because `build_single_tx_features` calls this on every single row
    and the batch endpoint calls that in a per-row loop -- a 3,000-row CSV was
    opening, reading and JSON-parsing the same small file 3,000 times.

    Returns a defensive copy: `build_era_relative` receives this and callers
    have no reason to expect a shared object, so handing out the cached frame
    itself would let one caller's mutation corrupt every later request.
    """
    return _load_era_stats_cached().copy()


def build_single_tx_features(
    req_dict: dict[str, Any],
    feature_order: list[str],
    token_data: dict[str, Any] | None = None,
) -> pd.DataFrame:
    """
    Transforms a single raw incoming transaction dictionary into the exact 61-feature vector.

    token_data, when provided, is the dict from
    token_lookup.get_wallet_token_features() (the 40 erc_20_*/erc_721_*
    values for req_dict's sender wallet) -- passed through to
    build_token_features() instead of the empty-frame default. Optional and
    defaults to None so replay_dataset.py/live_ingest_etherscan.py, which
    don't pass it, keep their existing behaviour unchanged.
    """
    raw_df = pd.DataFrame([req_dict])

    # 1. Static features
    df_static = build_static_features(raw_df)

    # 2. Token features (real per-wallet lookup if token_data provided, else
    #    defaults for unknown/cold-start wallets)
    if token_data:
        token_metadata = pd.DataFrame([{k: v for k, v in token_data.items() if not k.startswith("_")}])
    else:
        token_metadata = pd.DataFrame()
    df_token = build_token_features(raw_df, token_metadata)

    # Combine static and token features
    combined = pd.concat([df_static, df_token], axis=1)

    # Copy any directly provided features from req_dict (e.g., token presence flags)
    for col in feature_order:
        if col in raw_df.columns and col not in combined.columns:
            combined[col] = raw_df[col].astype(np.float32)

    # 3. Era-relative features using frozen stats baseline
    era_stats = load_era_stats()
    df_era = build_era_relative(combined, era_stats)

    # 4. Fill missing canonical features with 0.0
    for col in feature_order:
        if col not in df_era.columns:
            df_era[col] = np.float32(0.0)

    # Return exactly aligned 61 columns
    return df_era[feature_order]


# ----------------------------------------------------------------------------
# orchestration
# ----------------------------------------------------------------------------


def build_features(
    transactions: Sequence[RawTransaction],
    *,
    token_metadata: pd.DataFrame,
    wallet_history: pd.DataFrame,
    era_stats: pd.DataFrame,
    scaler: Any,
    feature_order: list[str],
    rolling_window: int,
) -> pd.DataFrame:
    """
    The one entry point the serving layer calls. Returns a frame with exactly
    the 61 columns in feature_order.
    """
    raw = pd.DataFrame([t.__dict__ for t in transactions])

    df = build_static_features(raw)
    df = df.join(build_token_features(raw, token_metadata))
    df = df.join(build_rolling_features(raw, wallet_history, rolling_window))
    df = build_era_relative(df, era_stats)
    df = apply_scaling(df, scaler)

    missing = [c for c in feature_order if c not in df.columns]
    if missing:
        raise RuntimeError(
            f"builder produced {len(df.columns)} columns, "
            f"{len(missing)} required feature(s) missing: {missing[:10]}"
        )
    return df[feature_order]

