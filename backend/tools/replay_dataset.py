#!/usr/bin/env python3
"""
replay_dataset.py - Dataset Replay Streamer for Aegis Command Center

Reads real dataset transactions from unified_final / test_wallet_grouped CSVs,
transforms them into canonical 61-feature vectors, scores them through all 7 AI models,
and streams real predictions to the frontend Monitor page via WebSocket broadcast.
"""

import os
import sys
import time
import zipfile
import logging
import requests
import pandas as pd
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from blocksoc_features.schema import load_feature_order, to_matrix
from blocksoc_features.builder import build_single_tx_features
from blocksoc_serving.registry import ModelRegistry

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("replay_streamer")


def find_dataset_file() -> Path | None:
    # 1. Prioritize unified_final_v7 (the exact file models were fit on)
    v7_csv = PROJECT_ROOT / "CSVs" / "unified_final_v7.csv"
    if v7_csv.exists():
        return v7_csv

    v7_archive_csv = PROJECT_ROOT / "CSVs" / "unified_final_v7_archive.csv"
    if v7_archive_csv.exists():
        return v7_archive_csv

    zip_path = PROJECT_ROOT / "CSVs" / "unified_final_v7.zip"
    if zip_path.exists():
        logger.info(f"Extracting primary research dataset from {zip_path.name}...")
        try:
            with zipfile.ZipFile(zip_path, "r") as z:
                extracted = z.extract(z.namelist()[0], path=PROJECT_ROOT / "CSVs")
                return Path(extracted)
        except Exception as e:
            logger.warning(f"Zip extraction failed: {e}")

    candidates = [
        PROJECT_ROOT / "CSVs" / "test_wallet_grouped.csv",
        PROJECT_ROOT / "CSVs" / "train_wallet_grouped.csv",
        PROJECT_ROOT / "CSVs" / "test_final.csv",
    ]
    for cand in candidates:
        if cand.exists():
            return cand
    return None


def run_replay_loop(speed_sec: float = 1.5):
    data_file = find_dataset_file()
    if not data_file:
        logger.error("No dataset CSV found in CSVs/ directory!")
        return

    logger.info(f"Loading dataset replay rows from: {data_file.name}...")
    # Load 1,000 rows for replay stream
    df = pd.read_csv(data_file, nrows=1000)
    
    feature_order_path = PROJECT_ROOT / "blocksoc_features" / "feature_order.json"
    feature_order = load_feature_order(feature_order_path)
    
    registry = ModelRegistry(csv_dir=PROJECT_ROOT / "CSVs")
    registry.load_all()

    logger.info(f"Starting replay loop across {len(df)} dataset rows at {speed_sec}s interval...")

    row_idx = 0
    while True:
        try:
            row = df.iloc[row_idx % len(df)].to_dict()
            
            row["to_address"] = str(row.get("to_address", row.get("address", "0x1111111254fb6c44bac0bed2854e76f90643097d")))
            row["from_address"] = str(row.get("from_address", row.get("address", "0xd8da6bf26964af9d7eed9e03e53415d37aa96045")))
            row["value"] = float(row.get("value", 1.45))
            row["gas"] = int(float(row.get("gas", 21000)))
            row["gas_used"] = int(float(row.get("gas_used", 21000)))
            row["effective_gas_price"] = int(float(row.get("effective_gas_price", 24500000000)))
            row["cumulative_gas_used"] = int(float(row.get("cumulative_gas_used", 1200000)))

            tx_hash = str(row.get("hash", f"0x{row_idx+10000:064x}"))
            from_addr = row["from_address"]
            to_addr = row["to_address"]
            block_num = int(row.get("block_number", 19485000 + (row_idx // 10)))
            
            # Build 61-feature vector
            df_features = build_single_tx_features(row, feature_order)
            X = to_matrix(df_features, feature_order)

            # Score through 7 Case C AI ensemble
            model_scores = registry.predict_all(X)
            consensus = registry.compute_consensus(model_scores)

            payload = {
                "hash": tx_hash[:18] + "..." if len(tx_hash) > 20 else tx_hash,
                "block_number": block_num,
                "from_address": from_addr,
                "to_address": to_addr,
                "value_eth": round(float(row.get("value", 1.45)), 4),
                "gas": int(float(row.get("gas", 21000))),
                "risk_score": consensus["overall_risk_score"],
                "verdict": consensus["verdict"],
                "action": consensus["action"],
                "agreement_percentage": consensus["agreement_percentage"],
                "ground_truth_flag": int(row.get("flag", -1)),
                "model_scores": model_scores,
                "timestamp": int(time.time()),
                "source": "replay",
            }

            # Broadcast live to FastAPI server WebSocket endpoint
            try:
                requests.post("http://localhost:8000/api/v1/stream/broadcast", json=payload, timeout=2)
                logger.info(f"Replay Row #{row_idx} | Tx: {payload['hash'][:14]} | Risk: {payload['risk_score']:.3f} | Verdict: {payload['verdict']}")
            except Exception as e:
                logger.warning(f"Could not broadcast payload to FastAPI: {e}")

            row_idx += 1
            time.sleep(speed_sec)
        except KeyboardInterrupt:
            logger.info("Replay loop stopped by user.")
            break
        except Exception as e:
            logger.error(f"Error in replay loop: {e}")
            time.sleep(2)


if __name__ == "__main__":
    run_replay_loop(speed_sec=1.5)
