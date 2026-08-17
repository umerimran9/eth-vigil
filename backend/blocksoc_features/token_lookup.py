"""
Live per-wallet ERC-20/ERC-721 token-holdings lookup.

Populates the 40 lexical token features at feature_order.json idx 13-52
(erc_20_* / erc_721_*) from a wallet's real Etherscan transfer history,
instead of the hardcoded zeros the live serving path used before.

IMPORTANT -- formula provenance:
The original training-pipeline source code for these 40 features could not
be found anywhere accessible: not in this repo, not in
blocksoc_features/00_port_investigation.ipynb (whose own conclusion, cell
22/25, is "No fill CODE exists in this repo for these 40 features"), and not
in DeFiTransLyzer (checked every file, every branch, including the
Development-only token_parser_v1.py/project_parser_v1.py -- neither contains
lexical feature logic, only raw JSON field extraction).

Of the 26 erc_20_* + 14 erc_721_* formulas below:
  - Symbol_End_Is_Digit, Name_Has_Digit, Symbol_Entropy/Name_Entropy formula,
    Log_Quantity, Log_Normalized_Quantity were specified exactly by the user.
  - Most others are mechanically unambiguous from the column name (counts,
    ratios, isalnum/isupper/islower checks).
  - Six erc_20_* formulas (Symbol_Contains_XYZ, Name_Starts_With_The,
    Name_Contains_Token, Symbol_Same_As_Name, Is_Zero_Divisor,
    Decimals_Above_10) have no recoverable source and are marked UNVERIFIED
    at their definition -- best-effort readings of the column name, approved
    for use but not confirmed ports. Is_Zero_Divisor has partial evidence
    (00_port_investigation.ipynb cell 80, invariant F: "Is_Zero_Divisor==1
    => Quantity_Is_Int==1", consistent with "decimals == 0").

Never raises. Every failure path (missing key, timeout, API error, empty
result, malformed response) returns the all-zero feature dict and logs a
warning -- callers do not need to wrap calls in try/except.
"""

from __future__ import annotations

import logging
import math
from collections import Counter
from typing import Any

import requests

logger = logging.getLogger("token_lookup")

ETHERSCAN_BASE_URL = "https://api.etherscan.io/v2/api"
REQUEST_TIMEOUT_SECONDS = 5

# Column order matches blocksoc_features/builder.py's erc20_cols/erc721_cols
# and feature_order.json idx 13-52 exactly.
ERC20_COLUMNS: list[str] = [
    "erc_20_Name_Uppercase_Ratio", "erc_20_Symbol_Is_Uppercase", "erc_20_Name_Contains_Token",
    "erc_20_Symbol_Contains_XYZ", "erc_20_Symbol_Starts_With_X", "erc_20_Name_Starts_With_The",
    "erc_20_Name_Num_Words", "erc_20_Name_Is_Alnum", "erc_20_Symbol_Is_Alnum", "erc_20_Name_Has_Digit",
    "erc_20_Symbol_Same_As_Name", "erc_20_Symbol_End_Is_Digit", "erc_20_Symbol_All_Same_Char",
    "erc_20_TokenQuantity", "erc_20_Log_Quantity", "erc_20_Log_Normalized_Quantity",
    "erc_20_Is_Zero_Divisor", "erc_20_Decimals_Above_10", "erc_20_Quantity_Is_Int",
    "erc_20_Unique_Chars_Name", "erc_20_Unique_Chars_Symbol", "erc_20_Name_Lowercase_Count",
    "erc_20_Symbol_Lowercase_Count", "erc_20_Name_Num_Uppercase", "erc_20_Symbol_Num_Uppercase",
    "erc_20_Symbol_Entropy",
]

ERC721_COLUMNS: list[str] = [
    "erc_721_Name_Uppercase_Ratio", "erc_721_Symbol_Is_Uppercase", "erc_721_Name_Contains_Token",
    "erc_721_Symbol_Contains_XYZ", "erc_721_Symbol_Has_Special", "erc_721_Name_Is_Alnum",
    "erc_721_Name_Has_Digit", "erc_721_Symbol_Has_Digit", "erc_721_TokenQuantity",
    "erc_721_Log_Quantity", "erc_721_Is_Zero_Divisor", "erc_721_Name_Num_Uppercase",
    "erc_721_Name_Entropy", "erc_721_Symbol_Entropy",
]

# dtype ground truth, sampled directly from preprocessing_v2/data/unified_final_v7.csv
_INT_COLUMNS: set[str] = {
    "erc_20_Symbol_Is_Uppercase", "erc_20_Name_Contains_Token", "erc_20_Symbol_Contains_XYZ",
    "erc_20_Symbol_Starts_With_X", "erc_20_Name_Starts_With_The", "erc_20_Name_Num_Words",
    "erc_20_Name_Is_Alnum", "erc_20_Symbol_Is_Alnum", "erc_20_Name_Has_Digit",
    "erc_20_Symbol_Same_As_Name", "erc_20_Symbol_End_Is_Digit", "erc_20_Symbol_All_Same_Char",
    "erc_20_Is_Zero_Divisor", "erc_20_Decimals_Above_10", "erc_20_Quantity_Is_Int",
    "erc_20_Unique_Chars_Name", "erc_20_Unique_Chars_Symbol", "erc_20_Name_Lowercase_Count",
    "erc_20_Symbol_Lowercase_Count", "erc_20_Name_Num_Uppercase", "erc_20_Symbol_Num_Uppercase",
    "erc_721_Symbol_Is_Uppercase", "erc_721_Name_Contains_Token", "erc_721_Symbol_Contains_XYZ",
    "erc_721_Symbol_Has_Special", "erc_721_Name_Is_Alnum", "erc_721_Name_Has_Digit",
    "erc_721_Symbol_Has_Digit", "erc_721_Is_Zero_Divisor", "erc_721_Name_Num_Uppercase",
}
_FLOAT_COLUMNS: set[str] = {
    "erc_20_Name_Uppercase_Ratio", "erc_20_TokenQuantity", "erc_20_Log_Quantity",
    "erc_20_Log_Normalized_Quantity", "erc_20_Symbol_Entropy",
    "erc_721_Name_Uppercase_Ratio", "erc_721_TokenQuantity", "erc_721_Log_Quantity",
    "erc_721_Name_Entropy", "erc_721_Symbol_Entropy",
}
assert _INT_COLUMNS | _FLOAT_COLUMNS == set(ERC20_COLUMNS) | set(ERC721_COLUMNS)
assert not (_INT_COLUMNS & _FLOAT_COLUMNS)

_wallet_token_cache: dict[str, dict[str, Any]] = {}


def _shannon_entropy(s: str) -> float:
    if not s:
        return 0.0
    n = len(s)
    return float(-sum((v / n) * math.log2(v / n) for v in Counter(s).values()))


def _zero_erc20() -> dict[str, Any]:
    return {col: (0 if col in _INT_COLUMNS else 0.0) for col in ERC20_COLUMNS}


def _zero_erc721() -> dict[str, Any]:
    out = {col: (0 if col in _INT_COLUMNS else 0.0) for col in ERC721_COLUMNS}
    out["erc_721_Is_Zero_Divisor"] = 1  # explicit fill per spec: no NFT found => 1
    return out


def _zero_features() -> dict[str, Any]:
    zeros = {**_zero_erc20(), **_zero_erc721()}
    zeros["_features_defaulted"] = True
    return zeros


def _fetch_etherscan(action: str, address: str, api_key: str) -> list[dict[str, Any]] | None:
    """
    Returns the result list, or None on any failure. Never raises.

    Asks for the single most recent transfer rather than the wallet's entire
    history. Both callers below (`_most_recent_erc20_entry`,
    `_most_recent_erc721_entry`) only ever read the newest row, so the old
    `sort=asc` over the full block range downloaded up to 10,000 records to
    use exactly one of them -- on an active wallet that is megabytes of JSON
    per lookup, parsed and thrown away, inside the 5s timeout budget.

    `sort=desc` + `page=1&offset=1` asks Etherscan for that one row directly.
    The result list is still returned newest-first, which is why the two
    helpers below now read `result[0]` instead of scanning from the end.
    """
    params = {
        "chainid": "1",
        "module": "account",
        "action": action,
        "address": address,
        "startblock": "0",
        "endblock": "99999999",
        "page": "1",
        "offset": "1",
        "sort": "desc",
        "apikey": api_key,
    }
    try:
        resp = requests.get(ETHERSCAN_BASE_URL, params=params, timeout=REQUEST_TIMEOUT_SECONDS)
        data = resp.json()
    except requests.exceptions.Timeout:
        logger.warning(f"Etherscan {action} timed out after {REQUEST_TIMEOUT_SECONDS}s for {address}")
        return None
    except Exception as e:
        logger.warning(f"Etherscan {action} request failed for {address}: {e}")
        return None

    if not isinstance(data, dict) or data.get("status") != "1":
        msg = data.get("message") if isinstance(data, dict) else str(data)
        logger.warning(f"Etherscan {action} returned no usable data for {address}: {msg}")
        return None

    result = data.get("result")
    if not isinstance(result, list) or not result:
        logger.warning(f"Etherscan {action} returned an empty result for {address}")
        return None
    return result


def _most_recent_erc20_entry(result: list[dict[str, Any]]) -> dict[str, Any] | None:
    """
    First tokentx row where tokenDecimal is present.

    Iterates forward, not reversed, because `_fetch_etherscan` now requests
    `sort=desc` -- the newest transfer is `result[0]`. The scan is kept rather
    than hard-coding `result[0]` so a row with a missing tokenDecimal (which
    would make `qty` meaningless) still falls through to the next-newest.
    """
    for entry in result:
        if entry.get("tokenDecimal") not in (None, ""):
            return entry
    return None


def _erc20_features(entry: dict[str, Any] | None) -> dict[str, Any]:
    if entry is None:
        return _zero_erc20()

    name = entry.get("tokenName") or ""
    symbol = entry.get("tokenSymbol") or ""
    try:
        decimals = int(entry.get("tokenDecimal") or 0)
    except (TypeError, ValueError):
        decimals = 0
    try:
        raw_value = int(entry.get("value") or 0)
    except (TypeError, ValueError):
        raw_value = 0
    qty = float(raw_value) / (10 ** decimals) if decimals >= 0 else float(raw_value)

    name_len = len(name)

    return {
        "erc_20_Name_Uppercase_Ratio": float(sum(c.isupper() for c in name)) / name_len if name_len else 0.0,
        "erc_20_Symbol_Is_Uppercase": int(bool(symbol) and symbol.isupper()),
        "erc_20_Name_Contains_Token": int("token" in name.lower()),  # UNVERIFIED
        "erc_20_Symbol_Contains_XYZ": int("XYZ" in symbol.upper()),  # UNVERIFIED
        "erc_20_Symbol_Starts_With_X": int(bool(symbol) and symbol.upper().startswith("X")),
        "erc_20_Name_Starts_With_The": int(name.strip().lower().startswith("the")),  # UNVERIFIED
        "erc_20_Name_Num_Words": len(name.split()),
        "erc_20_Name_Is_Alnum": int(bool(name) and name.isalnum()),
        "erc_20_Symbol_Is_Alnum": int(bool(symbol) and symbol.isalnum()),
        "erc_20_Name_Has_Digit": int(any(c.isdigit() for c in name)),
        "erc_20_Symbol_Same_As_Name": int(
            bool(symbol) and bool(name) and symbol.strip().lower() == name.strip().lower()
        ),  # UNVERIFIED
        "erc_20_Symbol_End_Is_Digit": int(bool(symbol) and symbol[-1].isdigit()),
        "erc_20_Symbol_All_Same_Char": int(bool(symbol) and len(set(symbol)) == 1),
        "erc_20_TokenQuantity": float(qty),
        "erc_20_Log_Quantity": float(math.log10(qty + 1)),
        "erc_20_Log_Normalized_Quantity": float(math.log10(qty / 1e9 + 1)),
        "erc_20_Is_Zero_Divisor": int(decimals == 0),  # backed by notebook cell 80 invariant F
        "erc_20_Decimals_Above_10": int(decimals > 10),  # UNVERIFIED boundary
        "erc_20_Quantity_Is_Int": int(qty == int(qty)),
        "erc_20_Unique_Chars_Name": len(set(name)),
        "erc_20_Unique_Chars_Symbol": len(set(symbol)),
        "erc_20_Name_Lowercase_Count": sum(c.islower() for c in name),
        "erc_20_Symbol_Lowercase_Count": sum(c.islower() for c in symbol),
        "erc_20_Name_Num_Uppercase": sum(c.isupper() for c in name),
        "erc_20_Symbol_Num_Uppercase": sum(c.isupper() for c in symbol),
        "erc_20_Symbol_Entropy": _shannon_entropy(symbol),
    }


def _most_recent_erc721_entry(result: list[dict[str, Any]]) -> dict[str, Any] | None:
    """First (most recent, since sort=desc) tokennfttx row."""
    return result[0] if result else None


def _erc721_features(entry: dict[str, Any] | None) -> dict[str, Any]:
    if entry is None:
        return _zero_erc721()

    name = entry.get("tokenName") or ""
    symbol = entry.get("tokenSymbol") or ""
    qty = 1.0  # non-fungible: exactly one token found in this lookup

    return {
        "erc_721_Name_Uppercase_Ratio": (
            float(sum(c.isupper() for c in name)) / len(name) if name else 0.0
        ),
        "erc_721_Symbol_Is_Uppercase": int(bool(symbol) and symbol.isupper()),
        "erc_721_Name_Contains_Token": int("token" in name.lower()),  # UNVERIFIED
        "erc_721_Symbol_Contains_XYZ": int("XYZ" in symbol.upper()),  # UNVERIFIED
        "erc_721_Symbol_Has_Special": int(any(not c.isalnum() and not c.isspace() for c in symbol)),
        "erc_721_Name_Is_Alnum": int(bool(name) and name.isalnum()),
        "erc_721_Name_Has_Digit": int(any(c.isdigit() for c in name)),
        "erc_721_Symbol_Has_Digit": int(any(c.isdigit() for c in symbol)),
        "erc_721_TokenQuantity": float(qty),
        "erc_721_Log_Quantity": float(math.log10(qty + 1)),
        "erc_721_Is_Zero_Divisor": 0,
        "erc_721_Name_Num_Uppercase": sum(c.isupper() for c in name),
        "erc_721_Name_Entropy": _shannon_entropy(name),
        "erc_721_Symbol_Entropy": _shannon_entropy(symbol),
    }


def get_wallet_token_features(wallet_address: str, api_key: str) -> dict:
    """
    Returns a dict of all 40 erc_20_*/erc_721_* features for wallet_address,
    plus a "_features_defaulted" bool (True if no real ERC-20 transfer
    history was found/usable -- see module docstring for why ERC-721 absence
    alone does not set this: most wallets legitimately hold no NFTs, and
    erc_20_Symbol_End_Is_Digit/Name_Has_Digit -- populated from the ERC-20
    lookup -- are the two highest-SHAP-weighted features in the ensemble).

    Cached per-process, keyed on wallet_address.lower(). Never raises.
    """
    if not wallet_address:
        return _zero_features()

    key = wallet_address.lower()
    if key in _wallet_token_cache:
        return _wallet_token_cache[key]

    if not api_key:
        logger.warning("get_wallet_token_features: no ETHERSCAN_API_KEY available; returning zeros")
        result = _zero_features()
        _wallet_token_cache[key] = result
        return result

    try:
        erc20_result = _fetch_etherscan("tokentx", key, api_key)
        erc20_entry = _most_recent_erc20_entry(erc20_result) if erc20_result else None
        erc20_feats = _erc20_features(erc20_entry)

        erc721_result = _fetch_etherscan("tokennfttx", key, api_key)
        erc721_entry = _most_recent_erc721_entry(erc721_result) if erc721_result else None
        erc721_feats = _erc721_features(erc721_entry)

        combined = {
            **erc20_feats,
            **erc721_feats,
            "_features_defaulted": erc20_entry is None,
        }
    except Exception as e:
        logger.warning(f"Unexpected error in get_wallet_token_features for {wallet_address}: {e}")
        combined = _zero_features()

    _wallet_token_cache[key] = combined
    return combined
