# AEGIS AI: End-to-End System Architecture & Technical Reference Manual
**Project:** Autonomous AI-Powered Ethereum Fraud Detection & SOC Intelligence Gateway  
**Dataset & Protocol Benchmark:** BCCC-DeFiFraudTrans-2025 (1,026,867 Transactions, 4,324 Wallets)  
**Document Version:** 2.0.0 (Production Architecture)  

---

## 1. Executive Summary & Core Philosophy

**Aegis AI** is a state-of-the-art, transaction-level Ethereum fraud detection and real-time security operations center (SOC) intelligence platform. Unlike conventional blockchain analytics systems that depend heavily on long historical address activity (which completely fails on brand-new malicious wallets), Aegis is engineered with a **cold-start first** architecture. 

### Core Design Principles:
1. **Cold-Start Transaction Robustness:** Evaluates transaction-intrinsic physics (gas dynamics, transfer economics, calldata entropy, and real-time wallet token holdings) rather than lifetime historical transaction graphs.
2. **Causal Era-Relative Normalization:** Mitigates severe temporal drift and blockchain protocol shifts (such as EIP-1559 gas mechanics) using causal rolling baselines without look-ahead data leakage.
3. **Multi-Model Consensus Inference:** Synthesizes predictions across 6 diverse AI architectures (Gradient Boosted Trees, Linear Guardrails, Deep Tabular Neural Networks, and Tabular Transformers).
4. **Exact Shapley Explainability (XAI):** Delivers mathematical, exact feature attribution waterfalls for every single prediction, identifying precise risk drivers versus benign mitigators.
5. **Real-Time Mainnet Telemetry & Forensic Audit:** Continuously ingests newly mined Ethereum blocks, streams real-time telemetry via WebSockets, and exports high-resolution single-page and multi-page Forensic PDF Audit Dossiers.

---

## 2. High-Level System Architecture & Data Flow

```
[Ethereum Mainnet L1] ---> [Etherscan Proxy API v2]
                                  │
                                  ▼
                    [Live Ingestion Worker Daemon]
                    (tools/live_ingest_etherscan.py)
                    • Polls latest mined blocks
                    • Enriches ERC-20 / ERC-721 token balances
                    • Safe neutral zero-imputation
                    • Builds 61-feature vector
                                  │
                                  ▼ (HTTP POST /broadcast)
                   [FastAPI Serving Gateway: 8000]
                         (WebApp/app.py)
                    • REST Endpoints & WebSocket Server
                    • Persistent SQLite Database (store.py)
                    • Model Registry (blocksoc_serving/registry.py)
                      ├── 6 Calibrated AI Models
                      ├── ModelSpaceTransform (RobustScaler)
                      ├── Consensus Engine (4 Voting Strategies)
                      └── Exact SHAP Explainability Engine
                                  │
                                  ▼ (WebSocket / REST API)
                   [Aegis React Web Platform: 3000]
                            (eth-vigil/)
                    • Zustand WebSocket Telemetry Store
                    • / (Core Dashboard)
                    • /detect (Single Tx Forensic & SHAP Waterfall)
                    • /monitor (Live Block Telemetry & Expandable Drawer)
                    • /batch (Multi-Row CSV Dataset Ingestion)
                    • /models (Model Architectures & Feature Importances)
                    • /analytics (Session Telemetry, 1-Page Landscape PDF)
                    • /settings (API Keys & Consensus Thresholds)
                    • Forensic PDF Audit Dossier Print Engine
```

---

## 3. Component Deep Dive

### 3.1. Live Ethereum Ingestion Worker (`tools/live_ingest_etherscan.py`)

The ingestion worker operates as a continuous background daemon that connects directly to the Ethereum Mainnet through the Etherscan Proxy API v2.

#### Operational Workflow:
1. **Block Polling:** Executes `eth_blockNumber` every 12 seconds to detect newly mined blocks.
2. **Block Retrieval:** Executes `eth_getBlockByNumber` with full transaction objects (`boolean="true"`).
3. **Wallet Token Enrichment (`token_lookup.py`):**
   - For each sender address (`from_address`), it queries `tokentx` and `tokennfttx` on Etherscan to evaluate live ERC-20 / ERC-721 token balances.
   - **Safe Baseline Imputation:** If an address has no prior token transfer history on Etherscan (e.g. a brand-new wallet executing raw ETH transactions), token metrics are imputed safely at neutral zero (`_features_defaulted = True`).
4. **On-the-Fly Vector Transformation:** Constructs the 61-feature vector in real-time via `build_single_tx_features()`.
5. **Ensemble Scoring & Consensus:** Feeds the matrix `X` across all 6 models, executes `predict_all()` and `compute_consensus()`.
6. **Local Broadcast:** Sends an HTTP POST to `http://localhost:8000/api/v1/stream/broadcast`, which immediately pushes the telemetry frame to all connected frontend clients via WebSocket.
7. **Synthetic Fallback Mode:** If the Etherscan API is rate-limited or offline, the worker gracefully transitions to synthetic simulation mode (`source="synthetic"`), ensuring continuous testing capability.

---

### 3.2. Feature Engineering & Preprocessing Pipeline (`blocksoc_features/`)

Aegis reduces the 171 raw columns of the BCCC-DeFiFraudTrans-2025 dataset down to **61 clean predictive features** and 1 binary label (`FLAG`), eliminating historical leakage while preserving essential fraud signals.

#### Feature Reduction Phases:
1. **Wallet Aggregate Elimination (-63 cols):** Removed all 55 `aggregate_*` columns and 8 wallet-lifetime aggregates that require prior historical memory.
2. **Identifier & Constant Elimination (-30 cols):** Dropped hash strings, address strings, and constant zero-variance features.
3. **Correlation Pruning (-22 cols):** Removed collinear features with Pearson correlation > 0.90 (handling zero-inflated ERC features independently).
4. **Temporal Ordering Feature Removal (-1 col):** Removed raw `block_number` from model inputs to prevent the models from memorizing historical timestamps.
5. **Causal Era-Relative Engineering (+6 cols):** Engineered 6 causal rolling-window relative features:
   - Uses a trailing window of 3,000 transactions with a minimum burn-in of 100 transactions.
   - Computes causal rolling mean and rolling standard deviation.
   - Normalizes feature x: clipped strictly to [-10, +10].
   - The current transaction is strictly excluded from its own baseline to avoid look-ahead bias.

#### 61 On-Chain Predictive Features Summary Table:

| Category | Count | Key Features Included |
| :--- | :--- | :--- |
| **Transaction Gas Dynamics** | 12 | `gas_used`, `gas_limit`, `gas_price`, `effective_gas_price`, `cumulative_gas_used`, `gas_efficiency`, `gas_burned_ratio`, `gas_used_era_rel` |
| **Transaction Value & Economics** | 10 | `value_eth`, `value_wei`, `value_usd_approx`, `is_zero_value`, `value_eth_era_rel`, `gas_to_value_ratio` |
| **Calldata & Nonce Execution** | 9 | `nonce`, `input_byte_length`, `is_contract_creation`, `is_empty_calldata`, `method_id_entropy`, `nonce_era_rel` |
| **Token Portfolio & Activity** | 18 | `token_holdings_count`, `erc20_transfer_count`, `erc721_count`, `unique_token_senders`, `unique_token_recipients`, `erc20_total_ether_received` |
| **Token Lexical & Name Characteristics** | 6 | `erc20_Name_Has_Digit`, `erc20_Symbol_End_Is_Digit`, `erc20_Name_Entropy`, `erc20_Symbol_Length`, `erc20_Name_Char_Uniqueness` |
| **Causal Era-Relative Mitigators** | 6 | `effective_gas_price_era_rel`, `gas_efficiency_era_rel`, `erc20_transfer_count_era_rel`, `token_holdings_era_rel`, `value_era_rel`, `nonce_era_rel` |

---

### 3.3. AI/ML Serving Engine & Model Registry (`blocksoc_serving/`)

The serving engine manages the lifecycle, transformations, predictions, and explainability of all production models.

#### Unified Model Adapters:
* **`TreeAdapter`:** Interfaces with Scikit-Learn `RandomForestClassifier`, `XGBClassifier`, and LightGBM `LGBMClassifier`.
* **`LinearAdapter`:** Interfaces with regularized `LogisticRegression` with calibrated probability thresholds.
* **`TorchAdapter`:** Interfaces with PyTorch Multi-Layer Perceptron (MLP) deep neural networks with GPU/CPU autoselection.
* **`TransformerAdapter`:** Interfaces with the Tabular FT-Transformer architecture (Feature Tokenizer + Transformer Encoder).

#### Production Model Benchmarks & Calibrated Thresholds:

| Model ID | Architecture Family | Pipeline Scaler | Calibrated Threshold | Validation ROC-AUC | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`lightgbm`** | Light Gradient Boosting Machine | `RobustScaler` | **`0.1578`** | **0.9716** | 🟢 Serving (Primary) |
| **`xgboost`** | Extreme Gradient Boosting | `RobustScaler` | **`0.4626`** | **0.9659** | 🟢 Serving |
| **`random_forest`** | Bagging Tree Ensemble | `RobustScaler` | **`0.3639`** | **0.9594** | 🟢 Serving |
| **`mlp`** | PyTorch Deep Neural Network | `RobustScaler` | **`0.6013`** | **0.9398** | 🟢 Serving |
| **`logistic_regression`** | Linear Probability Guardrail | `RobustScaler` | **`0.2469`** | **0.9228** | 🟢 Serving |
| **`transformer`** | PyTorch FT-Transformer | `RobustScaler` | **`0.5690`** | **0.9056** | 🟢 Serving |
| **`tabnet`** | Attentive Sparse TabNet | `None` | `0.5000` | `0.5034 (Case A)` | ⚠️ Withheld (Missing encoders) |

#### Consensus Aggregation Strategies:
1. **Weighted Average (`weighted_average`, Default):** Computes a weighted probability weighted by historical model PR-AUC benchmark quality.
2. **Majority Vote (`majority_vote`):** Requires >= 50% of models to agree on `FRAUD` to assign an elevated risk score.
3. **Max Risk (`max_risk`):** Adopts the maximum predicted fraud probability across all models as a strict defensive guardrail.
4. **Unanimous (`unanimous`):** Requires all 6 models to agree before declaring fraud.

#### Exact SHAP Explainability Engine:
* Generates exact local Shapley values for tree and linear models using `shap.TreeExplainer` and `shap.LinearExplainer`.
* Computes feature directional impacts:
  - Positive (> 0): **Risk Driver** (forces prediction toward Fraud).
  - Negative (< 0): **Benign Mitigator** (forces prediction toward Clear / Legitimate).
* Provides automated natural language diagnostic narratives summarizing top risk factors.

---

### 3.4. FastAPI Serving Gateway & REST/WebSocket APIs (`WebApp/app.py`)

The FastAPI application provides low-latency REST endpoints and high-concurrency WebSocket channels.

#### Key API Endpoints:

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| **`/api/v1/health`** | `GET` | Health status, loaded model count, feature count, and consensus strategies. |
| **`/api/v1/transactions/analyze`** | `POST` | Interrogates single transaction, performs token enrichment, scores 6 models, and generates SHAP waterfall. |
| **`/api/v1/batch/upload`** | `POST` | Ingests multi-row CSV files, scores row-by-row, and returns structured summary metrics. |
| **`/api/v1/history`** | `GET` | Fetches persistent SQLite scored transactions ledger with limit and source filters. |
| **`/api/v1/wallets/{address}/history`** | `GET` | Retrieves indexed transaction history for a specific wallet address. |
| **`/api/v1/stream/broadcast`** | `POST` | Ingestion worker webhook to broadcast newly scored transactions. |
| **`/api/v1/stream`** | `WebSocket` | Real-time WebSocket feed pushing live transaction scoring frames to connected clients. |

---

### 3.5. Frontend Web Application Platform (`eth-vigil/`)

The frontend is built with **React 18**, **TypeScript**, **Vite**, **TailwindCSS**, **TanStack Router**, **TanStack Query**, and **Zustand**.

#### Standardized 3-Tier Label Architecture:
* 🟢 **`Clear`** (Risk Score: `0.0% - 49.9%` | Level: `safe` | Color: `#00e5a3`)
* 🟡 **`Medium`** (Risk Score: `50.0% - 84.9%` | Level: `elevated` | Color: `#ffb547`)
* 🔴 **`High Risk`** (Risk Score: `85.0% - 100.0%` | Level: `high` | Color: `#ff4757`)

#### The 6 Core Navigation Modules:

1. 🌟 **Core Dashboard (`/`):**
   - High-level platform health, active model counts, pipeline throughput, and rapid navigation shortcuts.
2. 🔍 **Fraud Detection & SHAP Interrogation (`/detect`):**
   - Single-transaction parameter configuration (Hash, Addresses, Value, Gas, Nonce).
   - Live Etherscan enrichment indicator.
   - Executive Verdict Circular Risk Gauge.
   - 6-Model Ensemble Scorecard & Individual Model Probabilities.
   - **Exact SHAP Waterfall Chart:** Horizontal impact bars with directional indicators (+/-).
   - On-chain execution evidence & SOC mitigation protocol.
   - **Export Full Investigation PDF** button.
3. ⚡ **Live Ethereum Monitor (`/monitor`):**
   - Live block header ticker displaying current mined block number and status.
   - Search filter (by Hash, Address, Risk Level).
   - Full-width tabular telemetry list with pagination (10, 20, 50 rows/page).
   - Expandable in-row drawer with full parameters, model consensus, and direct deep-link to `/detect`.
   - 1-click **Download Forensic PDF** button per transaction.
4. 📁 **Batch CSV Ingestion (`/batch`):**
   - Drag-and-drop CSV dataset uploader with sample templates.
   - Full dataset summary tiles (Total rows, Fraud count, Legitimate count, Average risk).
   - Full data table with search, pagination, and expandable inspection drawer with SHAP explainability.
5. 🧠 **AI Models Intelligence (`/models`):**
   - Comprehensive model leaderboard comparing LightGBM, XGBoost, Random Forest, Logistic Regression, PyTorch MLP, and FT-Transformer.
   - Tuned decision thresholds, PR-AUC, ROC-AUC, and feature importance bar charts.
6. 📊 **Session Analytics & Telemetry (`/analytics`):**
   - 4 Top Metric Cards (Total Scored, High Risk Flagged, Clean Transactions, Average Risk).
   - 2x2 Telemetry Charts Grid (Risk Distribution, Classification Share Donut, Hourly Trend Timeline, Model Agreement Scatter).
   - **Export Session CSV:** Complete session history data download.
   - **Export Analytics PDF:** Formatted single-page landscape print report (`@page { size: landscape; margin: 6mm 8mm; }`).
7. ⚙️ **Platform Settings (`/settings`):**
   - Etherscan API Key configuration, WebSocket status, and consensus threshold tuning.

---

### 3.6. Forensic PDF Audit Dossier Engine (`ForensicPdfModal`)

The platform features a dedicated, print-optimized Forensic PDF generator that packages all telemetry into an official audit document.

#### Dossier Sections:
1. **Document Header:** Organization title, timestamp, protocol version (`BCCC-DeFiFraudTrans-2025`), risk badge (`Clear` / `Medium` / `High Risk`), and risk score out of 100.
2. **Section 1 - On-Chain Parameters & Execution Telemetry:** Transaction Hash, Block Number, From/To Addresses, ETH Value, Gas Limit, Gas Used, and Latency in milliseconds.
3. **Section 2 - Multi-Model Consensus Scorecard:** Grid displaying all 6 AI models with their individual fraud probabilities and color-coded risk flags.
4. **Section 3 - Exact SHAP Feature Attributions Table:** Top 8 driving features with feature names, actual transaction input values, exact Shapley values, and directional badges (▲ Risk Driver vs ▼ Benign Mitigator).
5. **Section 4 - Operational Security Recommendations:** Automated SOC action protocol checklist.
6. **Section 5 - Cryptographic Audit Stamp & Verification:** Official verification statement and footer.

---

## 4. Execution & Operational Guide

### Starting the Full Production Stack:

#### 1. Start the FastAPI Intelligence Backend:
```powershell
cd e:\fyp\new_preprocessing
.\.venv\Scripts\python.exe -u -m uvicorn WebApp.app:app --host 127.0.0.1 --port 8000
```
*Health Check:* `curl http://127.0.0.1:8000/api/v1/health`

#### 2. Start the Frontend React Web Platform:
```powershell
cd e:\fyp\eth-vigil
npm run dev -- --port 3000
```
*Access UI:* [http://localhost:3000/](http://localhost:3000/)

#### 3. Start the Live Ethereum Mainnet Ingestion Worker:
```powershell
cd e:\fyp\new_preprocessing
.\.venv\Scripts\python.exe -u tools/live_ingest_etherscan.py
```

---

## 5. Summary of Architecture File Structure

```text
e:\fyp/
├── UMERIMRAN_REPORT_FYP.docx                # Academic Thesis Document
├── AEGIS_SYSTEM_ARCHITECTURE_MANUAL.md       # This Architecture Reference Manual
│
├── new_preprocessing/                        # Backend Serving & ML Pipeline
│   ├── WebApp/
│   │   └── app.py                            # FastAPI Serving Gateway & WebSocket Broadcaster
│   ├── blocksoc_serving/
│   │   ├── registry.py                       # Model Adapters, Exact SHAP, & Consensus Engine
│   │   └── store.py                          # SQLite Persistent History Store
│   ├── blocksoc_features/
│   │   ├── schema.py                         # 61-Feature Contract & Schema Validation
│   │   ├── builder.py                        # Raw Tx to 61-Feature Matrix Builder
│   │   ├── transform.py                      # ModelSpaceTransform (RobustScaler Alignment)
│   │   └── token_lookup.py                   # Live Etherscan Token Enrichment & Zero-Imputation
│   ├── tools/
│   │   └── live_ingest_etherscan.py          # Continuous Mainnet Ingestion Worker
│   └── CSVs/                                 # Serialized Trained Model Checkpoints & Scalers
│
└── eth-vigil/                                # Modern React / Vite Web Application
    ├── src/
    │   ├── routes/
    │   │   ├── index.tsx                     # Core Dashboard (/)
    │   │   ├── detect.tsx                    # Fraud Detection & SHAP Interrogation (/detect)
    │   │   ├── monitor.tsx                   # Live Ethereum Block Monitor (/monitor)
    │   │   ├── batch.tsx                     # Multi-Row CSV Ingestion (/batch)
    │   │   ├── models.index.tsx              # Model Architectures & Leaderboard (/models)
    │   │   ├── analytics.tsx                 # Telemetry, 1-Page PDF & CSV Export (/analytics)
    │   │   └── settings.tsx                  # Platform Settings & API Configuration (/settings)
    │   ├── components/
    │   │   ├── forensic-pdf-modal.tsx        # Printable Forensic Audit Dossier Modal
    │   │   ├── nav-dock.tsx                  # 4-Cluster Glassmorphic Navigation Dock
    │   │   └── ui-kit.tsx                    # Design System, 3-Tier Badges & Stat Tiles
    │   ├── lib/
    │   │   ├── api.ts                        # Typed REST Client
    │   │   ├── stream-store.ts               # Zustand WebSocket Telemetry Store
    │   │   └── platform-data.ts              # 3-Tier Labels, Thresholds, & Consensus Rules
    │   └── styles.css                        # Design System Tokens & Print Stylesheet
    └── package.json
```
