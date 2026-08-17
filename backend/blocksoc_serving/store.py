"""
Durable storage for scored transactions.

Replaces `history_ledger`, a module-level Python list that lost everything on
restart -- which is why Cases, Analytics and Export all emptied whenever the
backend was bounced, and why no per-wallet history could be built.

SQLite rather than Postgres, deliberately. This is a single-machine demo: a
file needs no daemon, no container and no connection string, it survives a
restart, and the whole history can be handed to a supervisor as one artifact.
The schema is plain enough to move to Postgres later if that ever matters --
only `_connect` would change.

Concurrency: FastAPI runs sync endpoints in a threadpool and the ingest worker
writes from a separate process, so connections are opened per call rather than
shared, and WAL mode is enabled so readers never block the writer.
"""
from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

DB_PATH = Path(__file__).resolve().parent.parent / "CSVs" / "aegis_history.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS analyses (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id            TEXT    NOT NULL,
    hash               TEXT    NOT NULL,
    at                 TEXT    NOT NULL,   -- ISO-8601 UTC
    ts                 INTEGER NOT NULL,   -- unix seconds, for range queries
    source             TEXT    NOT NULL,   -- analyze | live | replay | synthetic | batch
    model_id           TEXT,               -- null when scored by the consensus
    from_address       TEXT,
    to_address         TEXT,
    value_eth          REAL,
    block_number       INTEGER,
    risk               REAL    NOT NULL,   -- 0-100
    verdict            TEXT    NOT NULL,
    action             TEXT,
    confidence         REAL,               -- 0-1 agreement
    agreed_models      INTEGER,
    total_models       INTEGER,
    features_defaulted INTEGER  NOT NULL DEFAULT 0,
    model_scores       TEXT,               -- JSON
    explainability     TEXT,               -- JSON
    transaction_json   TEXT                -- JSON
);
-- hash is NOT unique: the same transaction can legitimately be scored more
-- than once, through different models or after a retrain, and each of those is
-- a distinct record rather than an overwrite.
CREATE INDEX IF NOT EXISTS idx_analyses_ts      ON analyses(ts DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_hash    ON analyses(hash);
CREATE INDEX IF NOT EXISTS idx_analyses_from    ON analyses(from_address);
CREATE INDEX IF NOT EXISTS idx_analyses_source  ON analyses(source);
"""


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=10.0)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")     # readers don't block the writer
    con.execute("PRAGMA synchronous=NORMAL")   # durable enough for a demo, much faster
    return con


def init_db() -> None:
    with _connect() as con:
        con.executescript(SCHEMA)


def _dumps(v: Any) -> Optional[str]:
    return None if v is None else json.dumps(v, default=str)


def record_analysis(
    *,
    hash: str,
    risk: float,
    verdict: str,
    source: str = "analyze",
    model_id: Optional[str] = None,
    action: Optional[str] = None,
    confidence: Optional[float] = None,
    agreed_models: Optional[int] = None,
    total_models: Optional[int] = None,
    from_address: Optional[str] = None,
    to_address: Optional[str] = None,
    value_eth: Optional[float] = None,
    block_number: Optional[int] = None,
    features_defaulted: bool = False,
    model_scores: Any = None,
    explainability: Any = None,
    transaction: Any = None,
) -> Dict[str, Any]:
    """Persist one scored transaction. Returns the stored row as a dict.

    Never raises on a storage failure: a scored transaction that cannot be
    written is still a valid answer to the caller, and losing the response
    because logging failed would be the wrong trade. The failure is printed so
    it is not silent.
    """
    now = int(time.time())
    at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now))
    row = {
        "hash": hash, "at": at, "ts": now, "source": source, "model_id": model_id,
        "from_address": from_address, "to_address": to_address, "value_eth": value_eth,
        "block_number": block_number, "risk": risk, "verdict": verdict, "action": action,
        "confidence": confidence, "agreed_models": agreed_models, "total_models": total_models,
        "features_defaulted": int(bool(features_defaulted)),
        "model_scores": _dumps(model_scores), "explainability": _dumps(explainability),
        "transaction_json": _dumps(transaction),
    }
    try:
        with _connect() as con:
            cur = con.execute("SELECT COALESCE(MAX(id), 0) + 4821 AS n FROM analyses")
            row["case_id"] = f"AN-{cur.fetchone()['n']}"
            cols = ", ".join(row)
            con.execute(
                f"INSERT INTO analyses ({cols}) VALUES ({', '.join(':' + c for c in row)})", row
            )
    except Exception as e:
        print(f"[Warning] could not persist analysis: {type(e).__name__}: {e}")
        row.setdefault("case_id", "AN-unsaved")
    return row


def _hydrate(r: sqlite3.Row) -> Dict[str, Any]:
    """DB row -> the shape the API has always returned, so the frontend is unchanged."""
    d = dict(r)
    for src, dst in (("model_scores", "model_scores"),
                     ("explainability", "explainability"),
                     ("transaction_json", "transaction")):
        raw = d.pop(src, None)
        d[dst] = json.loads(raw) if raw else None
    d["id"] = d.pop("case_id")
    d.pop("ts", None)
    d["features_defaulted"] = bool(d.get("features_defaulted"))
    return d


def get_history(limit: int = 100, source: Optional[str] = "analyze") -> List[Dict[str, Any]]:
    """Most recent first. `source=None` returns every source, including the live feed."""
    try:
        with _connect() as con:
            if source:
                cur = con.execute(
                    "SELECT * FROM analyses WHERE source = ? ORDER BY ts DESC, id DESC LIMIT ?",
                    (source, limit))
            else:
                cur = con.execute(
                    "SELECT * FROM analyses ORDER BY ts DESC, id DESC LIMIT ?", (limit,))
            return [_hydrate(r) for r in cur.fetchall()]
    except Exception as e:
        print(f"[Warning] could not read history: {type(e).__name__}: {e}")
        return []


def get_wallet_history(address: str, limit: int = 100) -> List[Dict[str, Any]]:
    """Every scored transaction sent by one wallet.

    The endpoint a wallet-detail view needs, and impossible against the old
    in-memory list because it was never indexed by address.
    """
    try:
        with _connect() as con:
            cur = con.execute(
                "SELECT * FROM analyses WHERE LOWER(from_address) = LOWER(?) "
                "ORDER BY ts DESC, id DESC LIMIT ?", (address, limit))
            return [_hydrate(r) for r in cur.fetchall()]
    except Exception as e:
        print(f"[Warning] could not read wallet history: {type(e).__name__}: {e}")
        return []


def stats() -> Dict[str, Any]:
    """Counts by source and verdict, computed in SQL rather than in the page."""
    try:
        with _connect() as con:
            total = con.execute("SELECT COUNT(*) AS n FROM analyses").fetchone()["n"]
            by_source = {r["source"]: r["n"] for r in con.execute(
                "SELECT source, COUNT(*) AS n FROM analyses GROUP BY source")}
            by_verdict = {r["verdict"]: r["n"] for r in con.execute(
                "SELECT verdict, COUNT(*) AS n FROM analyses GROUP BY verdict")}
            wallets = con.execute(
                "SELECT COUNT(DISTINCT LOWER(from_address)) AS n FROM analyses "
                "WHERE from_address IS NOT NULL").fetchone()["n"]
            return {"total": total, "by_source": by_source,
                    "by_verdict": by_verdict, "distinct_wallets": wallets,
                    "db_path": str(DB_PATH)}
    except Exception as e:
        return {"total": 0, "error": f"{type(e).__name__}: {e}", "db_path": str(DB_PATH)}
