#!/usr/bin/env python3
"""
live_ingest_etherscan.py - Real-Time Ethereum Mainnet Ingestion Worker

Polls Etherscan Proxy APIs for latest mined blocks and real transactions,
transforms them via blocksoc_features.builder into the 61-feature vector,
scores them across all 7 Case C AI models, and broadcasts predictions via WebSocket.
Includes high-fidelity fallback generator when offline or rate-limited.
"""

import os
import sys
import time
import json
import random
import logging
import requests
import pandas as pd
from typing import Dict, Any, List, Optional
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Load .env file
env_path = PROJECT_ROOT / ".env"
if env_path.exists():
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()

ETHERSCAN_API_KEY = os.environ.get("ETHERSCAN_API_KEY", "")
BASE_URL = "https://api.etherscan.io/v2/api"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("live_ingest")

from blocksoc_features.schema import load_feature_order, to_matrix
from blocksoc_features.builder import build_single_tx_features
from blocksoc_features.token_lookup import get_wallet_token_features
from blocksoc_serving.registry import ModelRegistry

class EtherscanIngestWorker:
    def __init__(self, api_key: str = ETHERSCAN_API_KEY):
        self.api_key = api_key
        self.registry = ModelRegistry(csv_dir=PROJECT_ROOT / "CSVs")
        self.registry.load_all()
        
        if not self.registry.models:
            reasons = "\n  ".join(f"{k}: {v}" for k, v in self.registry.unavailable.items())
            logger.warning(f"Models unavailable:\n  {reasons}")
            
        feature_order_path = PROJECT_ROOT / "blocksoc_features" / "feature_order.json"
        self.feature_order = load_feature_order(feature_order_path)
        self.last_block_processed = 0
        logger.info(
            f"Initialized EtherscanIngestWorker with {len(self.registry.models)} models loaded. "
            f"API Key: {'configured' if self.api_key else 'none (fallback simulation ready)'}"
        )

    def get_latest_block_number(self) -> Optional[int]:
        if not self.api_key:
            return None
        params = {
            "chainid": "1",
            "module": "proxy",
            "action": "eth_blockNumber",
            "apikey": self.api_key,
        }
        try:
            res = requests.get(BASE_URL, params=params, timeout=10)
            data = res.json()
            if "result" in data and isinstance(data["result"], str):
                return int(data["result"], 16)
        except Exception as e:
            logger.error(f"Error fetching latest block number: {e}")
        return None

    def get_block_by_number(self, block_number: int) -> Optional[Dict[str, Any]]:
        if not self.api_key:
            return None
        hex_block = hex(block_number)
        params = {
            "chainid": "1",
            "module": "proxy",
            "action": "eth_getBlockByNumber",
            "tag": hex_block,
            "boolean": "true",
            "apikey": self.api_key,
        }
        try:
            res = requests.get(BASE_URL, params=params, timeout=12)
            data = res.json()
            if "result" in data and isinstance(data["result"], dict):
                return data["result"]
        except Exception as e:
            logger.error(f"Error fetching block {block_number}: {e}")
        return None

    def process_transaction(
        self, tx_dict: Dict[str, Any], block_number: int, source: str = "live"
    ) -> Optional[Dict[str, Any]]:
        try:
            tx_hash = tx_dict.get("hash", "0x" + "".join(random.choices("0123456789abcdef", k=64)))
            from_addr = tx_dict.get("from") or tx_dict.get("from_address") or "0x" + "".join(random.choices("0123456789abcdef", k=40))
            to_addr = tx_dict.get("to") or tx_dict.get("to_address") or "0x" + "".join(random.choices("0123456789abcdef", k=40))
            
            value_raw = tx_dict.get("value", 0)
            if isinstance(value_raw, str):
                value_wei = int(value_raw, 16) if value_raw.startswith("0x") else int(value_raw)
            else:
                value_wei = int(value_raw)

            gas_raw = tx_dict.get("gas", 21000)
            gas_limit = int(gas_raw, 16) if isinstance(gas_raw, str) and gas_raw.startswith("0x") else int(gas_raw)
            
            gas_price_raw = tx_dict.get("gasPrice", 20000000000)
            gas_price = int(gas_price_raw, 16) if isinstance(gas_price_raw, str) and gas_price_raw.startswith("0x") else int(gas_price_raw)
            
            nonce_raw = tx_dict.get("nonce", 0)
            nonce = int(nonce_raw, 16) if isinstance(nonce_raw, str) and nonce_raw.startswith("0x") else int(nonce_raw)

            req_payload = {
                "hash": tx_hash,
                "block_number": block_number,
                "from_address": from_addr,
                "to_address": to_addr,
                "value": value_wei,
                "gas": gas_limit,
                "gas_used": gas_limit,
                "effective_gas_price": gas_price,
                "cumulative_gas_used": 1200000,
                "nonce": nonce,
                "input_data": tx_dict.get("input", "0x"),
            }

            token_data = get_wallet_token_features(from_addr, self.api_key)
            features_defaulted = bool(token_data.get("_features_defaulted", True))

            df_features = build_single_tx_features(req_payload, self.feature_order, token_data=token_data)
            X = to_matrix(df_features, self.feature_order)

            # Score through all 7 models
            model_scores = self.registry.predict_all(X)
            consensus = self.registry.compute_consensus(model_scores)

            result_payload = {
                "hash": tx_hash,
                "block_number": block_number,
                "from_address": from_addr,
                "to_address": to_addr,
                "value_eth": round(value_wei / 1e18, 6),
                "gas": gas_limit,
                "risk_score": consensus["overall_risk_score"],
                "verdict": consensus["verdict"],
                "action": consensus["action"],
                "agreement_percentage": consensus["agreement_percentage"],
                "model_scores": model_scores,
                "features_defaulted": features_defaulted,
                "timestamp": int(time.time()),
                # Passed in by the caller, not inferred from whether a key
                # exists. It used to read `"live" if self.api_key else "replay"`,
                # which mislabelled twice over: rows invented by the fallback
                # generator below were tagged "live" whenever a key was
                # configured (so random.choices output arrived in the monitor
                # under a LIVE MAINNET badge), and when no key was set they
                # were tagged "replay" -- a word that means the held-out test
                # set everywhere else in this project.
                "source": source,
            }

            # Broadcast to local FastAPI serving WebSocket
            try:
                requests.post("http://localhost:8000/api/v1/stream/broadcast", json=result_payload, timeout=2)
            except Exception:
                pass

            return result_payload
        except Exception as e:
            logger.error(f"Error processing transaction {tx_dict.get('hash')}: {e}")
            return None

    def poll_once(self) -> List[Dict[str, Any]]:
        latest = self.get_latest_block_number()
        
        if not latest:
            # Fallback generator: no real block was retrievable (no key, rate
            # limit, network failure). Everything below is invented by
            # random.choices -- it is not mainnet data and not dataset replay,
            # so it is broadcast as source="synthetic" and the UI shows it as
            # such rather than vouching for it.
            logger.warning("No block retrievable from Etherscan; emitting a SYNTHETIC transaction.")
            simulated_block = (self.last_block_processed or 19485000) + 1
            sample_tx = {
                "hash": "0x" + "".join(random.choices("0123456789abcdef", k=64)),
                "from": "0x" + "".join(random.choices("0123456789abcdef", k=40)),
                "to": "0x" + "".join(random.choices("0123456789abcdef", k=40)),
                "value": int(random.uniform(0.01, 15.5) * 1e18),
                "gas": random.choice([21000, 45000, 125000, 280000]),
                "gasPrice": int(random.uniform(15, 65) * 1e9),
                "nonce": random.randint(1, 150),
            }
            res = self.process_transaction(sample_tx, simulated_block, source="synthetic")
            self.last_block_processed = simulated_block
            return [res] if res else []

        if self.last_block_processed == 0:
            self.last_block_processed = latest - 1

        if latest <= self.last_block_processed:
            return []

        target_block = self.last_block_processed + 1
        logger.info(f"Fetching mined Ethereum block #{target_block}...")
        block = self.get_block_by_number(target_block)

        if not block or "transactions" not in block:
            return []

        txs = block["transactions"]
        results = []
        sample_txs = txs[:8] if isinstance(txs, list) else []
        for tx in sample_txs:
            if isinstance(tx, dict):
                res = self.process_transaction(tx, target_block, source="live")
                if res:
                    results.append(res)
                    logger.info(f"Scored Tx {res['hash'][:12]}... | Risk: {res['risk_score']:.3f} | Verdict: {res['verdict']}")

        self.last_block_processed = target_block
        return results


if __name__ == "__main__":
    worker = EtherscanIngestWorker()
    print("[*] Starting continuous live Etherscan ingestion loop...")
    while True:
        try:
            results = worker.poll_once()
            time.sleep(12)
        except KeyboardInterrupt:
            print("[!] Stopped ingestion loop.")
            break
        except Exception as e:
            logger.error(f"Ingestion error: {e}")
            time.sleep(5)
