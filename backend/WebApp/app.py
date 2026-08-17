"""
BlockSOC / Aegis FastAPI Production Serving Gateway.

Exposes REST & WebSocket APIs for real-time transaction scoring across 7 AI models,
multi-model consensus strategies, XAI explainability, batch CSV processing,
executive forensic audit report generation, and live Ethereum telemetry streaming.
"""

from __future__ import annotations

import hashlib
import io
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

# Ensure root directory is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import numpy as np
import pandas as pd
from fastapi import FastAPI, File, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from blocksoc_features.builder import RawTransaction, build_single_tx_features
from blocksoc_features.schema import load_feature_order, to_matrix
from blocksoc_features.token_lookup import get_wallet_token_features
from blocksoc_features.transform import is_model_space
from blocksoc_serving.registry import ModelRegistry
from blocksoc_serving import store

logger = logging.getLogger("app")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

base_dir = Path(__file__).resolve().parent.parent
csv_dir = base_dir / "CSVs"
feature_order_path = base_dir / "blocksoc_features" / "feature_order.json"

env_path = base_dir / ".env"
if env_path.exists():
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()

ETHERSCAN_API_KEY = os.environ.get("ETHERSCAN_API_KEY", "")
if not ETHERSCAN_API_KEY:
    logger.warning("ETHERSCAN_API_KEY not found in environment; live token lookups will default safely.")

feature_order = load_feature_order(feature_order_path)
registry = ModelRegistry(csv_dir=csv_dir)
registry.load_all()

# Durable history. Replaces the in-memory list that lost every scored
# transaction on restart.
store.init_db()

app = FastAPI(
    title="Aegis Ethereum AI/ML Fraud Intelligence Gateway",
    version="2.0.0",
    description="State-of-the-Art Blockchain Security Serving Gateway with 7 Trained Models & Real-Time Etherscan Ingestion",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeTransactionRequest(BaseModel):
    hash: Optional[str] = Field("0x" + "0" * 64, description="Transaction hash")
    block_number: Optional[int] = Field(19485021, description="Block number")
    from_address: str = Field(..., description="Sender wallet address")
    to_address: Optional[str] = Field(None, description="Recipient address or contract")
    value: int = Field(0, description="Transfer value in Wei")
    gas: int = Field(21000, description="Gas limit")
    gas_used: int = Field(21000, description="Gas used")
    effective_gas_price: int = Field(24500000000, description="Effective gas price in Wei")
    cumulative_gas_used: int = Field(1200000, description="Cumulative gas in block")
    nonce: int = Field(0, description="Wallet nonce")
    input_data: Optional[str] = Field("0x", description="Calldata input hex")
    erc20_transfers: Optional[List[Dict[str, Any]]] = None
    model_id: Optional[str] = Field(None, description="Specific model to test (e.g. 'xgboost', 'tabnet', 'transformer') or 'consensus'")
    consensus_strategy: Optional[str] = Field("weighted_average", description="Consensus strategy: weighted_average | majority_vote | max_risk | unanimous")


class GenerateReportRequest(BaseModel):
    hash: str = Field(..., description="Transaction hash for forensic report")
    notes: Optional[str] = Field(None, description="Investigator notes")
    examiner: Optional[str] = Field("Aegis Autonomous SOC Analyst", description="Examiner name or ID")


@app.get("/health")
@app.get("/api/v1/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": int(time.time()),
        "models_loaded": len(registry.models),
        "total_expected_models": 7,
        "feature_count": len(feature_order),
        "available_models": list(registry.models.keys()),
        "consensus_strategies": ["weighted_average", "majority_vote", "max_risk", "unanimous"],
        "unavailable_models": registry.unavailable,
    }




@app.get("/api/v1/history")
def get_analysis_history(limit: int = 100, source: Optional[str] = Query("analyze")):
    """Scored transactions, most recent first, from the SQLite store.

    `source` defaults to "analyze" so this stays the record of deliberate
    investigations. Pass source= (empty) to include the live feed as well.
    """
    rows = store.get_history(limit=limit, source=source or None)
    return {"status": "success", "total_records": len(rows), "history": rows}


@app.get("/api/v1/wallets/{address}/history")
def get_wallet_history(address: str, limit: int = 100):
    """Every scored transaction from one wallet -- the query the old in-memory
    list could not answer, because it was never indexed by address."""
    rows = store.get_wallet_history(address, limit=limit)
    return {"status": "success", "address": address, "total_records": len(rows), "history": rows}


@app.get("/api/v1/history/stats")
def history_stats():
    return {"status": "success", "data": store.stats()}


@app.post("/api/v1/transactions/analyze")
def analyze_transaction(req: AnalyzeTransactionRequest):
    if not registry.models:
        raise HTTPException(
            status_code=503,
            detail=(
                "No models are currently being served. "
                + "; ".join(f"{k}: {v}" for k, v in registry.unavailable.items())
            ),
        )

    req_dict = req.model_dump()
    selected_model = req.model_id.lower().replace("-", "_") if req.model_id else None
    if selected_model in ["all", "ensemble", "none", ""]:
        selected_model = None

    consensus_strat = req.consensus_strategy or "weighted_average"

    # 0. Live per-wallet token-holdings lookup via Etherscan
    token_data = get_wallet_token_features(req.from_address, ETHERSCAN_API_KEY)
    features_defaulted = bool(token_data.get("_features_defaulted", True))

    # 1. Transform raw incoming transaction into canonical 61-feature vector
    df_features = build_single_tx_features(req_dict, feature_order, token_data=token_data)
    X_matrix = to_matrix(df_features, feature_order)

    # 2. Score across all 7 production models (or filtered)
    model_scores = registry.predict_all(X_matrix)
    consensus = registry.compute_consensus(model_scores, strategy=consensus_strat)

    # 3. Compute XAI feature attribution waterfall
    feature_signals = registry.explain_prediction(X_matrix, feature_order)
    # Real Shapley values alongside the heuristic table. Exact for the tree and
    # linear models, ~150ms warm; the neural models are excluded and the payload
    # names which models it covers so the UI never implies otherwise.
    shap_explanation = registry.explain_shap(X_matrix, feature_order)
    top_feature = feature_signals[0]["feature"] if feature_signals else "gas_efficiency_era_rel"

    # Full 61-feature vector for Transaction DNA
    raw_features = [
        {"feature": name, "value": round(float(X_matrix[0][i]), 6)}
        for i, name in enumerate(feature_order)
    ]

    # If single model was selected, reflect its specific assessment as primary view
    if selected_model and selected_model in model_scores:
        m_res = model_scores[selected_model]
        primary_risk = m_res["probability"]
        primary_verdict = m_res["verdict"]
        primary_action = (
            "BLOCK_AND_QUARANTINE" if primary_risk >= 0.85
            else "FLAG_FOR_MANUAL_REVIEW" if primary_risk >= 0.50
            else "PASS_AND_MONITOR"
        )
        assessment = {
            "overall_risk_score": round(primary_risk, 4),
            "verdict": primary_verdict,
            "action": primary_action,
            "agreed_models": 1,
            "total_models": 1,
            "agreement_percentage": 100.0,
            "active_model": selected_model,
            "strategy": f"Single Model ({selected_model.upper()})",
        }
    else:
        assessment = consensus

    recommendations = []
    if assessment["overall_risk_score"] >= 0.85:
        recommendations = [
            f"Immediately block & blacklist interaction with wallet {req.from_address[:10]}...",
            "Quarantine destination contract and halt automated bridging / liquidity routing",
            "File critical SOC incident report with cryptographic audit trail",
        ]
    elif assessment["overall_risk_score"] >= 0.50:
        recommendations = [
            "Escalate transaction to L2 security engineer for manual calldata inspection",
            "Verify token contract creator address and tokenomics distribution",
            "Apply temporary settlement delay on downstream token transfers",
        ]
    else:
        recommendations = [
            "Transaction cleared under baseline standard operational security parameters",
            "Standard on-chain settlement approved with telemetry monitoring",
        ]

    transaction_obj = {
        "hash": req.hash or ("0x" + "0" * 64),
        "block_number": req.block_number,
        "timestamp": int(time.time()),
        "from_address": req.from_address,
        "to_address": req.to_address,
        "value_eth": round(req.value / 1e18, 6),
        "gas_used": req.gas_used,
        "effective_gas_price_gwei": round(req.effective_gas_price / 1e9, 2),
    }

    model_scores_list = [
        {
            "model_id": m_id,
            "name": m_id.upper().replace("_", " "),
            "probability": res["probability"],
            "threshold": res["threshold"],
            "verdict": res["verdict"],
        }
        for m_id, res in model_scores.items()
    ]

    shap_paragraph = registry.generate_shap_paragraph(
        assessment=assessment,
        attributions=feature_signals,
        model_scores=model_scores,
        tx_info=transaction_obj,
    )

    explainability_obj = {
        "primary_risk_driver": top_feature,
        "feature_signals": feature_signals,
        "shap": shap_explanation,
        "method": "heuristic_importance_table",
        "narrative_summary": (
            f"Transaction evaluated with overall risk score {assessment['overall_risk_score'] * 100:.1f}%. "
            f"Verdict: {assessment['verdict']}. Evaluated across {len(model_scores)} AI models."
        ),
        "narrative_paragraph": shap_paragraph,
    }

    # Persisted to SQLite rather than appended to a list, so Cases, Analytics
    # and Export survive a restart and a per-wallet history becomes queryable.
    store.record_analysis(
        hash=req.hash or ("0x" + "0" * 64),
        source="analyze",
        model_id=selected_model,
        from_address=req.from_address,
        to_address=req.to_address,
        value_eth=round(req.value / 1e18, 6),
        block_number=req.block_number,
        risk=round(assessment["overall_risk_score"] * 100, 1),
        verdict=assessment["verdict"],
        action=assessment["action"],
        confidence=assessment["agreement_percentage"] / 100.0,
        agreed_models=assessment["agreed_models"],
        total_models=assessment["total_models"],
        features_defaulted=features_defaulted,
        model_scores=model_scores_list,
        explainability=explainability_obj,
        transaction=transaction_obj,
    )

    return {
        "status": "success",
        "data": {
            "transaction": transaction_obj,
            "assessment": assessment,
            "consensus": consensus,
            "features_defaulted": features_defaulted,
            "model_scores": model_scores_list,
            "explainability": explainability_obj,
            "raw_features": raw_features,
            "recommendations": recommendations,
        },
    }


@app.post("/api/v1/report/generate")
def generate_forensic_report(req: GenerateReportRequest):
    """
    Generate an official executive cryptographic forensic audit certificate.
    """
    record = next(
        (r for r in store.get_history(limit=1000, source=None)
         if r["hash"] == req.hash or r["id"] == req.hash),
        None,
    )

    # Two fallbacks used to sit here and both had to go.
    #
    # The first silently substituted `history_ledger[-1]` -- the most recent
    # analysis -- whenever the requested hash was not found. So asking for a
    # certificate for transaction A returned a certificate for transaction B,
    # with A's hash nowhere in it and nothing indicating the swap.
    #
    # The second, when the ledger was empty, invented an entire record:
    # risk 87.5, verdict HIGH_RISK_FRAUD, seven model scores with made-up
    # probabilities (0.92 / 0.88 / 0.85 / 0.89 / 0.84 / 0.82 / 0.51) including
    # a model that is not served at all, and three fabricated feature signals.
    # That fiction was then SHA-256'd, labelled a "cryptographic forensic
    # audit certificate", stamped with an examiner name, and handed back as
    # evidence. A signature over invented data is worse than no signature: it
    # makes the invention look verified.
    #
    # A certificate can only be issued for an analysis that actually ran.
    if not record:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No analysis found for {req.hash!r}. A certificate can only be issued for a "
                "transaction this backend has actually scored — run it through Investigate first. "
                "(The in-memory ledger is cleared when the backend restarts.)"
            ),
        )

    raw_signature = f"{record['hash']}:{record['risk']}:{record['verdict']}:{record['at']}"
    cert_hash = hashlib.sha256(raw_signature.encode()).hexdigest()

    report_payload = {
        "report_id": f"AEGIS-CERT-{cert_hash[:12].upper()}",
        "certificate_hash": "0x" + cert_hash,
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        "examiner": req.examiner,
        "investigator_notes": req.notes or "Automated on-chain forensic verification executed via Aegis Multi-Model AI Consensus Engine.",
        "case_id": record.get("id", "AN-4821"),
        "transaction": record.get("transaction", {}),
        "assessment": {
            "risk_score_pct": record.get("risk", 0.0),
            "verdict": record.get("verdict", "UNKNOWN"),
            "action": record.get("action", "REVIEW"),
            "confidence_pct": round(record.get("confidence", 0.85) * 100, 1),
            "agreed_models": record.get("agreed_models", 6),
            "total_models": record.get("total_models", 7),
        },
        "model_evaluations": record.get("model_scores", []),
        "explainability": record.get("explainability", {}),
        "recommendations": [
            "Quarantine flagged transaction hash across all connected decentralized bridges",
            "Submit wallet telemetry event to SOC Incident Log and compliance reporting queue",
            "Monitor destination smart contract for liquidity drain or recursive calls",
        ],
    }

    return {"status": "success", "report": report_payload}


def _row_verdict(risk: float) -> str:
    if risk >= 0.85:
        return "HIGH_RISK_FRAUD"
    if risk >= 0.50:
        return "SUSPICIOUS_ACTIVITY"
    return "LEGITIMATE"


@app.get("/api/v1/transactions/resolve/{tx_hash}")
def resolve_transaction(tx_hash: str):
    """
    Fetch a real transaction from Ethereum by hash.

    This is the piece that was missing. Before it existed, pasting a hash into
    the UI did nothing but label the case: `req.hash` was copied into the
    response and the history record, while scoring ran on whatever from/to/
    value/gas the form happened to hold -- which in hash mode were the demo
    defaults. Every hash therefore produced an identical verdict.

    Returns the fields the analyze endpoint expects, so the caller can resolve
    first and score second without the scoring path changing at all.
    """
    if not (tx_hash.startswith("0x") and len(tx_hash) == 66):
        raise HTTPException(
            status_code=400,
            detail=f"{tx_hash!r} is not a transaction hash (expected 0x + 64 hex characters).",
        )
    if not ETHERSCAN_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="No ETHERSCAN_API_KEY configured, so a hash cannot be looked up. "
                   "Enter the transaction's values manually instead.",
        )

    import requests

    def _rpc(action: str, **kw):
        params = {"chainid": "1", "module": "proxy", "action": action,
                  "apikey": ETHERSCAN_API_KEY, **kw}
        r = requests.get("https://api.etherscan.io/v2/api", params=params, timeout=10)
        return r.json().get("result")

    try:
        tx = _rpc("eth_getTransactionByHash", txhash=tx_hash)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Etherscan request failed: {e}")

    if not isinstance(tx, dict):
        raise HTTPException(
            status_code=404,
            detail=f"No transaction found for {tx_hash} on Ethereum mainnet.",
        )

    # The receipt carries gas_used and cumulative_gas_used -- the transaction
    # object only has the gas LIMIT. Both are real model features, so the
    # second call is worth it; if it fails we fall back to the limit and say so.
    receipt = None
    try:
        receipt = _rpc("eth_getTransactionReceipt", txhash=tx_hash)
    except Exception:
        pass

    def _hex(v, default=0):
        try:
            return int(v, 16) if isinstance(v, str) and v.startswith("0x") else int(v or default)
        except (TypeError, ValueError):
            return default

    gas_limit = _hex(tx.get("gas"), 21000)
    gas_used = _hex(receipt.get("gasUsed"), gas_limit) if isinstance(receipt, dict) else gas_limit
    cumulative = _hex(receipt.get("cumulativeGasUsed"), 0) if isinstance(receipt, dict) else 0
    eff_price = (_hex(receipt.get("effectiveGasPrice"), 0) if isinstance(receipt, dict) else 0)         or _hex(tx.get("gasPrice"), 0)

    return {
        "status": "success",
        "data": {
            "hash": tx.get("hash", tx_hash),
            "block_number": _hex(tx.get("blockNumber"), 0),
            "from_address": tx.get("from") or "",
            "to_address": tx.get("to"),          # null for contract creation
            "value": _hex(tx.get("value"), 0),   # wei
            "gas": gas_limit,
            "gas_used": gas_used,
            "effective_gas_price": eff_price,
            "cumulative_gas_used": cumulative,
            "nonce": _hex(tx.get("nonce"), 0),
            "input_data": tx.get("input", "0x"),
            # Tells the UI which numbers are measured vs defaulted, so it can
            # say so rather than presenting a fallback as fact.
            "receipt_available": isinstance(receipt, dict),
        },
    }


@app.post("/api/v1/batch/upload")
def process_batch_csv(file: UploadFile = File(...), model_id: Optional[str] = Query(None)):
    """model_id scores the batch through one named model instead of the ensemble.
    None (or 'consensus') keeps the mean-probability consensus."""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = file.file.read()
    try:
        df_batch_raw = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse the CSV: {e}")
    if len(df_batch_raw) == 0:
        raise HTTPException(status_code=400, detail="The uploaded CSV has no rows.")

    missing = [c for c in feature_order if c not in df_batch_raw.columns]
    is_feature_matrix = not missing

    if is_feature_matrix:
        df_batch = df_batch_raw.reindex(columns=feature_order, fill_value=0.0).fillna(0.0)
    else:
        rows = [
            build_single_tx_features(row._asdict() if hasattr(row, "_asdict") else dict(row), feature_order)
            for row in (r for _, r in df_batch_raw.iterrows())
        ]
        df_batch = pd.concat(rows, ignore_index=True)

    X_matrix = to_matrix(df_batch, feature_order)
    already_scaled = is_feature_matrix and is_model_space(df_batch, feature_order)
    feature_space = "model" if already_scaled else "raw"

    if not registry.models:
        raise HTTPException(
            status_code=503,
            detail="No models are currently loaded.",
        )

    selected = (model_id or "").lower().replace("-", "_")
    if selected in ("", "consensus", "all", "ensemble"):
        selected = None
    if selected and selected not in registry.models:
        raise HTTPException(
            status_code=400,
            detail=f"{model_id!r} is not being served. Available: {', '.join(registry.models)}.",
        )

    model_scores = registry.predict_all(X_matrix, already_model_space=already_scaled)
    if selected:
        model_scores = {selected: model_scores[selected]}

    probas_list = [np.asarray(m["probability"], dtype=float).reshape(-1) for m in model_scores.values()]
    avg_probas = np.mean(np.vstack(probas_list), axis=0) if probas_list else np.zeros(len(df_batch))

    flagged_high = int(np.sum(avg_probas >= 0.85))
    flagged_suspicious = int(np.sum((avg_probas >= 0.50) & (avg_probas < 0.85)))
    legit_count = int(np.sum(avg_probas < 0.50))

    # Build per-model probabilities map
    model_probas = {k: np.asarray(m["probability"], dtype=float).reshape(-1) for k, m in model_scores.items()}

    rows_out = []
    max_return_rows = min(500, len(df_batch))
    for i in range(max_return_rows):
        r_raw = df_batch_raw.iloc[i] if i < len(df_batch_raw) else None
        val = None
        gas = None
        from_addr = None
        to_addr = None
        tx_hash = None

        if r_raw is not None:
            if "value" in r_raw and pd.notna(r_raw["value"]):
                try:
                    val = float(r_raw["value"])
                except Exception:
                    val = 0.0
            if "gas_used" in r_raw and pd.notna(r_raw["gas_used"]):
                try:
                    gas = float(r_raw["gas_used"])
                except Exception:
                    gas = 21000.0
            for col in ["from_address", "from", "sender"]:
                if col in r_raw and pd.notna(r_raw[col]):
                    from_addr = str(r_raw[col])
                    break
            for col in ["to_address", "to", "recipient", "contract"]:
                if col in r_raw and pd.notna(r_raw[col]):
                    to_addr = str(r_raw[col])
                    break
            for col in ["hash", "tx_hash", "transaction_hash"]:
                if col in r_raw and pd.notna(r_raw[col]):
                    tx_hash = str(r_raw[col])
                    break

        per_model_map = {k: round(float(v[i]), 4) for k, v in model_probas.items() if i < len(v)}

        rows_out.append({
            "row_index": i,
            "risk_score": round(float(avg_probas[i]), 4),
            "verdict": _row_verdict(float(avg_probas[i])),
            "value": val,
            "gas_used": gas,
            "from_address": from_addr,
            "to_address": to_addr,
            "hash": tx_hash,
            "model_scores": per_model_map,
        })

    return {
        "status": "success",
        "batch_summary": {
            "total_rows": len(df_batch),
            "flagged_fraud_count": flagged_high + flagged_suspicious,
            "high_risk_count": flagged_high,
            "suspicious_count": flagged_suspicious,
            "legitimate_count": legit_count,
            "average_risk_score": round(float(np.mean(avg_probas)), 4),
            "feature_space": feature_space,
            "scored_by": list(model_scores.keys()),
            "model_id": selected or "consensus",
        },
        "row_scores": rows_out,
    }


active_connections: List[WebSocket] = []


@app.websocket("/api/v1/stream/live")
async def websocket_live_stream(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in active_connections:
            active_connections.remove(websocket)


@app.post("/api/v1/stream/broadcast")
async def broadcast_live_transaction(payload: Dict[str, Any]):
    # Persist the feed as well as fanning it out. Stored under its own source
    # ("live" / "replay" / "synthetic") so /history keeps returning deliberate
    # investigations by default and the feed never inflates those counts.
    try:
        if payload.get("hash"):
            store.record_analysis(
                hash=str(payload["hash"]),
                source=str(payload.get("source") or "live"),
                from_address=payload.get("from_address"),
                to_address=payload.get("to_address"),
                value_eth=payload.get("value_eth"),
                block_number=payload.get("block_number"),
                risk=round(float(payload.get("risk_score") or 0.0) * 100, 1),
                verdict=str(payload.get("verdict") or "UNKNOWN"),
                action=payload.get("action"),
                confidence=(float(payload["agreement_percentage"]) / 100.0
                            if payload.get("agreement_percentage") is not None else None),
                features_defaulted=bool(payload.get("features_defaulted")),
                model_scores=payload.get("model_scores"),
            )
    except Exception as e:
        print(f"[Warning] could not persist feed item: {type(e).__name__}: {e}")

    disconnected = []
    for ws in active_connections:
        try:
            await ws.send_json(payload)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        if ws in active_connections:
            active_connections.remove(ws)
    return {"status": "broadcast_sent", "active_clients": len(active_connections)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
