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
  | "transformer";

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
  /** Tuned on this fold's validation slice. Precision and recall are
   *  threshold-dependent, so the two must travel together. */
  threshold: number;
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
    threshold: 0.1578,
    latencyMs: 0.9,
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
    accuracy: 0.9167,
    precision: 0.7592,
    recall: 0.9941,
    f1: 0.8609,
    rocAuc: 0.9508,
    prAuc: 0.7882,
    threshold: 0.265,
    latencyMs: 1.01,
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
    accuracy: 0.8581,
    precision: 0.7878,
    recall: 0.6197,
    f1: 0.6937,
    rocAuc: 0.9586,
    prAuc: 0.8085,
    threshold: 0.3639,
    latencyMs: 40.2,
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
    accuracy: 0.802,
    precision: 0.5718,
    recall: 0.9413,
    f1: 0.7115,
    rocAuc: 0.9235,
    prAuc: 0.8509,
    threshold: 0.2469,
    latencyMs: 0.24,
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
    accuracy: 0.907,
    precision: 0.7964,
    recall: 0.8616,
    f1: 0.8277,
    rocAuc: 0.9449,
    prAuc: 0.7765,
    threshold: 0.6013,
    latencyMs: 0.55,
    params: "TorchScript export",
    advantages: ["0.9212 ROC-AUC, 0.7389 PR-AUC — walk-forward, templated-excluded (Case C)", "Precision 74.16% at decile-9, templated-excluded"],
    limitations: ["Requires restricted RobustScaler guardrails", "Lower recall on unseen wallets"],
  },
  // TabNet withheld from the UI 2026-08-16. Its scores are not trustworthy at
  // serving time: the notebook integer-encodes 28 columns through `cat_encoders`
  // before training, and that encoder map was never exported. TabNetAdapter
  // stands in a clamp to [0, 1], which sends the wrong embedding index for every
  // column that is not already binary -- length_to (always 42) and gas_price_ratio
  // among them. Measured: with the clamp it returns 0.7506 on the sample
  // transaction; without it, pytorch-tabnet raises IndexError from the embedding
  // lookup. Either way it is not seeing what it was trained on.
  //
  // The backend still loads it, so /health continues to report it and the
  // consensus still includes it -- only the model picker hides it.
  //
  // To restore: export cat_encoders alongside the checkpoint (same gap the fold
  // scaler had), apply it in TabNetAdapter.predict_proba before inference, then
  // re-add the entry below with its metrics from
  // case_c/tabnet/TABNEToutputs/tabnet_decile9_templated_exclusion.csv
  // (PR-AUC 0.6436, ROC-AUC 0.8718, precision 0.7366, recall 0.5560, F1 0.6336,
  //  accuracy 0.8333, threshold 0.6997, latency 16.15 ms p50).
  {
    id: "transformer",
    name: "FT-Transformer",
    family: "Tabular Transformer",
    tagline: "Feature tokenizer plus self-attention over the 61-feature vector.",
    architecture:
      "Single tokenizer over all 61 features at d_token 16, 2-layer TransformerEncoder with CLS pooling, LayerNorm + linear head. Geometry read from the shipped checkpoint, not assumed.",
    accuracy: 0.747,
    precision: 0.5124,
    recall: 0.5033,
    f1: 0.5078,
    rocAuc: 0.7848,
    prAuc: 0.4697,
    threshold: 0.569,
    latencyMs: 1.22,
    params: "2 layers · d_token 16",
    advantages: ["Learned inter-feature attention", "Sub-2ms inference"],
    limitations: [
      "Weakest model in the ensemble at 0.4697 PR-AUC, roughly half the leader",
      "ROC-AUC falls 0.894 -> 0.634 on wallets never seen in training",
    ],
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
  /** Mean |SHAP| over the templated-excluded decile-9 sample, normalised per
   *  model before averaging -- TreeExplainer returns log-odds contributions
   *  and LinearExplainer returns coefficient x deviation, so raw magnitudes
   *  are not comparable across model families. Rankings are. */
  importance: number;
}

// Real SHAP, regenerated from CSVs/wf_decile9/shap_top_features_wfdecile9.csv.
// Computed on the decile-9 model over templated-excluded rows -- the same
// model and population as the published metrics. The previous list was
// hand-written and led by erc_20_Symbol_End_Is_Digit, which ranked first only
// because the old explanation fold was ~50% one templated wallet whose ERC-20
// columns never varied. With those 7 wallets excluded it leaves the top eight
// entirely.
//
// The `shap` and `value` fields are gone: they were per-transaction numbers on
// a constant, which only ever made sense for one invented example.
export const FEATURES: Feature[] = [
  { key: "erc_721_TokenQuantity", label: "ERC-721 Token Quantity", importance: 1.0000 },
  { key: "erc_20_Name_Num_Uppercase", label: "ERC-20 Name Uppercase Count", importance: 0.9647 },
  { key: "erc_20_Name_Uppercase_Ratio", label: "ERC-20 Name Uppercase Ratio", importance: 0.8793 },
  { key: "erc_20_TokenQuantity", label: "ERC-20 Token Quantity", importance: 0.8558 },
  { key: "erc_20_Symbol_Entropy", label: "ERC-20 Symbol Entropy", importance: 0.8351 },
  { key: "erc_721_Is_Zero_Divisor", label: "ERC-721 Zero Divisor", importance: 0.6153 },
  { key: "erc_20_Log_Normalized_Quantity", label: "ERC-20 Log Normalised Quantity", importance: 0.5500 },
  { key: "erc_20_Quantity_Is_Int", label: "ERC-20 Quantity Is Integer", importance: 0.5313 },
];



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

