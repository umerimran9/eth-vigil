export type RiskLevel = "safe" | "elevated" | "high";

// "ft-transformer" removed 2026-08-09: TorchAdapter has no code path for its
// real checkpoint architecture and was silently serving an untrained,
// randomly-initialized fallback network (see forensic_audit_2026-08-09.md,
// CR-02). Dropped from the live ensemble until a proper adapter exists.
export type ModelId =
  | "lightgbm"
  | "xgboost"
  | "random-forest"
  | "logistic-regression"
  | "mlp"
  | "tabnet";

export interface AiModel {
  id: ModelId;
  name: string;
  family: string;
  tagline: string;
  architecture: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  rocAuc: number;
  prAuc: number;
  latencyMs: number;
  params: string;
  advantages: string[];
  limitations: string[];
}

export const MODELS: AiModel[] = [
  {
    id: "lightgbm",
    name: "LightGBM",
    family: "Gradient Boosting",
    tagline: "Leaf-wise gradient boosting (Case C class-weighted baseline).",
    architecture:
      "Histogram-based gradient boosted decision trees with leaf-wise growth tuned on 61 tabular features.",
    accuracy: 0.9231,
    precision: 0.7763,
    recall: 0.9884,
    f1: 0.8696,
    rocAuc: 0.9656,
    prAuc: 0.8398,
    latencyMs: 1.8,
    params: "1.2K trees · Case C",
    advantages: [
      "Sub-2ms inference latency at production scale",
      "Native handling of zero-inflated token features",
      "Stable feature attributions across retrains",
    ],
    limitations: [
      "Requires class-weight tuning for imbalance",
      "Weaker on unseen wallet behaviour patterns",
    ],
  },
  {
    id: "xgboost",
    name: "XGBoost",
    family: "Gradient Boosting",
    tagline: "Regularised gradient boosting with scale_pos_weight.",
    architecture:
      "Level-wise gradient boosted decision trees with depth 6, subsample 0.8, colsample 0.8, early stopping 50.",
    accuracy: 0.8302,
    precision: 0.7002,
    recall: 0.6025,
    f1: 0.6477,
    rocAuc: 0.9402,
    prAuc: 0.7528,
    latencyMs: 2.5,
    params: "600 trees · depth 6",
    advantages: [
      "0.9402 ROC-AUC, 0.7528 PR-AUC — walk-forward, templated-excluded (Case C)",
      "Strong regularisation reduces false positives",
    ],
    limitations: ["Higher memory footprint", "Requires 61-column exact ordering"],
  },
  {
    id: "random-forest",
    name: "Random Forest",
    family: "Bagging Ensemble",
    tagline: "Bagged decision tree baseline over wallet-grouped splits.",
    architecture:
      "600 fully-grown decision trees over bootstrapped samples with Gini impurity criterion.",
    accuracy: 0.8573,
    precision: 0.7943,
    recall: 0.6071,
    f1: 0.6882,
    rocAuc: 0.9566,
    prAuc: 0.8026,
    latencyMs: 12.0,
    params: "600 trees",
    advantages: ["0.9566 ROC-AUC, 0.8026 PR-AUC — walk-forward, templated-excluded (Case C)", "Auditable per-tree decision paths"],
    limitations: ["Larger artefact size (~220 MB)", "Recall 60.71% at decile-9, templated-excluded"],
  },
  {
    id: "logistic-regression",
    name: "Logistic Regression",
    family: "Linear Model",
    tagline: "L2-penalised linear interpretability reference.",
    architecture:
      "L2-regularised logistic regression fit on restricted RobustScaler features (gas_efficiency, cumulative_gas_used).",
    accuracy: 0.8020,
    precision: 0.5718,
    recall: 0.9413,
    f1: 0.7115,
    rocAuc: 0.9235,
    prAuc: 0.8509,
    latencyMs: 0.3,
    params: "61 coefficients",
    advantages: ["Sub-millisecond inference (0.3 ms)", "Linear coefficients map directly to regulator language"],
    limitations: ["Cannot capture feature interactions", "Requires era-relative z-scoring"],
  },
  {
    id: "mlp",
    name: "PyTorch MLP",
    family: "Neural Network",
    tagline: "Multi-Layer Perceptron capturing non-linear feature interactions.",
    architecture:
      "Deep neural network 61 → 256 → 128 → 64 → 2 with GELU activations and batch normalisation.",
    accuracy: 0.8224,
    precision: 0.7416,
    recall: 0.4836,
    f1: 0.5854,
    rocAuc: 0.9212,
    prAuc: 0.7389,
    latencyMs: 1.1,
    params: "TorchScript export",
    advantages: ["0.9212 ROC-AUC, 0.7389 PR-AUC — walk-forward, templated-excluded (Case C)", "Precision 74.16% at decile-9, templated-excluded"],
    limitations: ["Requires restricted RobustScaler guardrails", "Lower recall on unseen wallets"],
  },
  {
    id: "tabnet",
    name: "TabNet",
    family: "Attentive Tabular NN",
    tagline: "Sequential attention with built-in feature selection.",
    architecture:
      "Sparse attentive feature masks across 8 decision steps with ghost batch normalisation.",
    accuracy: 0.8333,
    precision: 0.7366,
    recall: 0.5560,
    f1: 0.6336,
    rocAuc: 0.8718,
    prAuc: 0.6436,
    latencyMs: 8.0,
    params: "TabNet Zip Checkpoint",
    advantages: ["F1 63.36% at decile-9, templated-excluded", "Instance-level sparse masks"],
    limitations: ["Requires non-negative index input bounds", "Pinned artifact"],
  },
];

export const modelById = (id: string) => {
  const norm = id.toLowerCase().replace(/_/g, "-");
  return MODELS.find((m) => m.id === norm || m.id === id || m.id.replace(/-/g, "_") === id);
};

export const rocCurve = (auc: number) =>
  Array.from({ length: 21 }, (_, i) => {
    const fpr = i / 20;
    const k = 1 + (auc - 0.9) * 40;
    return { fpr, tpr: Math.min(1, Math.pow(fpr, 1 / (2 + k))) };
  });

export const prCurve = (auc: number) =>
  Array.from({ length: 21 }, (_, i) => {
    const recall = i / 20;
    return { recall, precision: Math.max(0.3, auc - Math.pow(recall, 3.2) * (1 - auc + 0.16)) };
  });

export interface Feature {
  key: string;
  label: string;
  importance: number;
  shap: number;
  value: string;
}

export const FEATURES: Feature[] = [
  { key: "erc_20_Symbol_End_Is_Digit", label: "ERC-20 Symbol End Is Digit", importance: 0.244, shap: +0.342, value: "1.0" },
  { key: "gas_efficiency", label: "Gas Efficiency (gas_used / gas)", importance: 0.188, shap: +0.184, value: "1.000" },
  { key: "cumulative_gas_used", label: "Cumulative Gas Used in Block", importance: 0.163, shap: -0.042, value: "1,200,000" },
  { key: "erc_20_Name_Has_Digit", label: "ERC-20 Name Contains Digit", importance: 0.155, shap: +0.215, value: "1.0" },
  { key: "erc_20_Symbol_Same_As_Name", label: "ERC-20 Symbol Same As Name", importance: 0.050, shap: -0.012, value: "0.0" },
  { key: "effective_gas_price", label: "Effective Gas Price (Wei)", importance: 0.045, shap: +0.089, value: "24,500,000,000" },
  { key: "total_gas_cost", label: "Total Gas Cost (Eth)", importance: 0.042, shap: +0.076, value: "0.000514" },
  { key: "value", label: "Transaction Ether Value", importance: 0.038, shap: +0.095, value: "1.45 ETH" },
];

export const FRAUD_TREND = [
  { day: "Mon", flagged: 128, cleared: 1840, volume: 1968 },
  { day: "Tue", flagged: 164, cleared: 2010, volume: 2174 },
  { day: "Wed", flagged: 142, cleared: 2260, volume: 2402 },
  { day: "Thu", flagged: 209, cleared: 2190, volume: 2399 },
  { day: "Fri", flagged: 266, cleared: 2480, volume: 2746 },
  { day: "Sat", flagged: 188, cleared: 1920, volume: 2108 },
  { day: "Sun", flagged: 151, cleared: 1760, volume: 1911 },
];

export const MODEL_USAGE = MODELS.map((m, i) => ({
  name: m.name,
  runs: 4200 - i * 420 + (i % 2 === 0 ? 260 : 0),
}));

export const TIMELINE = Array.from({ length: 24 }, (_, i) => ({
  hour: `${String(i).padStart(2, "0")}:00`,
  risk: 18 + Math.round(28 * Math.abs(Math.sin(i / 3.4)) + (i % 5) * 2),
  throughput: 320 + Math.round(210 * Math.abs(Math.cos(i / 4.1))),
}));

export interface Txn {
  hash: string;
  from: string;
  to: string;
  value: number;
  gas: number;
  block: number;
  risk: number;
  level: RiskLevel;
  ts: number;
}

export const levelFromRisk = (risk: number): RiskLevel =>
  risk > 72 ? "high" : risk > 38 ? "elevated" : "safe";

// Maps the backend's own verdict strings (registry.py:compute_consensus, 0.85/0.50
// cutoffs) straight to a display level -- trust the backend's decision instead of
// re-deriving one from the raw score with a different cutoff.
export const levelFromVerdict = (verdict: string | undefined, riskFallback?: number): RiskLevel => {
  switch (verdict) {
    case "HIGH_RISK_FRAUD":
    case "FRAUD":
      return "high";
    case "SUSPICIOUS_ACTIVITY":
      return "elevated";
    case "LEGITIMATE":
      return "safe";
    default:
      return riskFallback !== undefined ? levelFromRisk(riskFallback) : "safe";
  }
};

// action comes from registry.py:compute_consensus -- BLOCK_AND_QUARANTINE /
// FLAG_FOR_MANUAL_REVIEW / PASS_AND_MONITOR.
export const actionLabel = (action: string | undefined): string => {
  switch (action) {
    case "BLOCK_AND_QUARANTINE":
      return "Block & quarantine";
    case "FLAG_FOR_MANUAL_REVIEW":
      return "Flag for manual review";
    case "PASS_AND_MONITOR":
      return "Pass & monitor";
    default:
      return "Review manually";
  }
};

export const verdictLabel = (verdict: string | undefined): string => {
  switch (verdict) {
    case "HIGH_RISK_FRAUD":
      return "High risk fraud";
    case "SUSPICIOUS_ACTIVITY":
      return "Suspicious activity";
    case "LEGITIMATE":
      return "Legitimate";
    case "FRAUD":
      return "Fraud";
    default:
      return verdict ?? "Unknown";
  }
};

