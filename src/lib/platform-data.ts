export type RiskLevel = "safe" | "elevated" | "high";

export type ModelId =
  | "lightgbm"
  | "xgboost"
  | "random-forest"
  | "logistic-regression"
  | "mlp"
  | "ft-transformer"
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
  confusion: { tn: number; fp: number; fn: number; tp: number };
  advantages: string[];
  limitations: string[];
}

export const MODELS: AiModel[] = [
  {
    id: "lightgbm",
    name: "LightGBM",
    family: "Gradient Boosting",
    tagline: "Leaf-wise boosting tuned for high-cardinality wallet features.",
    architecture:
      "Histogram-based gradient boosted decision trees with leaf-wise growth, 1,200 estimators, depth-limited at 12 with L2 leaf regularisation.",
    accuracy: 0.987,
    precision: 0.974,
    recall: 0.961,
    f1: 0.967,
    rocAuc: 0.996,
    prAuc: 0.981,
    latencyMs: 4,
    params: "1.2K trees · 31 leaves",
    confusion: { tn: 18420, fp: 132, fn: 168, tp: 4280 },
    advantages: [
      "Fastest inference of the ensemble at production scale",
      "Native handling of sparse, skewed transaction volumes",
      "Stable feature attributions across retrains",
    ],
    limitations: [
      "Sensitive to extreme class imbalance without tuned weights",
      "Weaker on unseen wallet behaviour patterns",
    ],
  },
  {
    id: "xgboost",
    name: "XGBoost",
    family: "Gradient Boosting",
    tagline: "Regularised boosting, the accuracy anchor of the consensus.",
    architecture:
      "Level-wise gradient boosted trees with depth 8, subsample 0.8, colsample 0.7 and scale_pos_weight calibrated to the fraud base rate.",
    accuracy: 0.985,
    precision: 0.978,
    recall: 0.953,
    f1: 0.965,
    rocAuc: 0.995,
    prAuc: 0.979,
    latencyMs: 6,
    params: "900 trees · depth 8",
    confusion: { tn: 18461, fp: 91, fn: 209, tp: 4239 },
    advantages: [
      "Strong regularisation reduces false positives",
      "Battle-tested calibration for risk scoring",
    ],
    limitations: ["Slower to retrain on full chain history", "Higher memory footprint"],
  },
  {
    id: "random-forest",
    name: "Random Forest",
    family: "Bagging Ensemble",
    tagline: "Variance-killing baseline with transparent decision paths.",
    architecture:
      "600 fully-grown decision trees over bootstrapped samples, Gini criterion, sqrt feature sampling per split.",
    accuracy: 0.972,
    precision: 0.951,
    recall: 0.934,
    f1: 0.942,
    rocAuc: 0.988,
    prAuc: 0.961,
    latencyMs: 11,
    params: "600 trees",
    confusion: { tn: 18338, fp: 214, fn: 294, tp: 4154 },
    advantages: ["Highly robust to noisy labels", "Auditable per-tree decision paths"],
    limitations: ["Larger artefact size", "Recall trails boosted models"],
  },
  {
    id: "logistic-regression",
    name: "Logistic Regression",
    family: "Linear Model",
    tagline: "The interpretability reference every audit starts from.",
    architecture:
      "L2-penalised logistic regression on standardised features, LBFGS solver, isotonic probability calibration.",
    accuracy: 0.931,
    precision: 0.893,
    recall: 0.871,
    f1: 0.882,
    rocAuc: 0.958,
    prAuc: 0.9,
    latencyMs: 1,
    params: "48 coefficients",
    confusion: { tn: 18089, fp: 463, fn: 574, tp: 3874 },
    advantages: ["Sub-millisecond scoring", "Coefficients map directly to regulator language"],
    limitations: ["Cannot capture feature interactions", "Underfits laundering chains"],
  },
  {
    id: "mlp",
    name: "MLP",
    family: "Neural Network",
    tagline: "Dense network capturing non-linear wallet interactions.",
    architecture:
      "Feed-forward network 48 → 256 → 128 → 64 → 1 with GELU activations, dropout 0.2 and batch normalisation.",
    accuracy: 0.968,
    precision: 0.944,
    recall: 0.941,
    f1: 0.942,
    rocAuc: 0.986,
    prAuc: 0.957,
    latencyMs: 8,
    params: "412K params",
    confusion: { tn: 18304, fp: 248, fn: 262, tp: 4186 },
    advantages: ["Learns interaction effects gradient trees miss", "Cheap to fine-tune online"],
    limitations: ["Requires careful feature scaling", "Less stable attributions"],
  },
  {
    id: "ft-transformer",
    name: "FT Transformer",
    family: "Tabular Transformer",
    tagline: "Attention over feature tokens — the deep specialist.",
    architecture:
      "Feature tokeniser plus 6 transformer blocks, 8 attention heads, d_token 192, with CLS-token readout head.",
    accuracy: 0.983,
    precision: 0.969,
    recall: 0.966,
    f1: 0.967,
    rocAuc: 0.994,
    prAuc: 0.977,
    latencyMs: 27,
    params: "3.1M params",
    confusion: { tn: 18415, fp: 137, fn: 151, tp: 4297 },
    advantages: [
      "Best recall on novel obfuscation patterns",
      "Attention maps double as explanations",
    ],
    limitations: ["Highest inference latency", "Needs GPU for batch workloads"],
  },
  {
    id: "tabnet",
    name: "TabNet",
    family: "Attentive Tabular NN",
    tagline: "Sequential attention with built-in feature selection.",
    architecture:
      "8 decision steps with sparse attentive feature masks, ghost batch normalisation and sparsity regularisation γ=1.3.",
    accuracy: 0.976,
    precision: 0.958,
    recall: 0.949,
    f1: 0.953,
    rocAuc: 0.99,
    prAuc: 0.968,
    latencyMs: 19,
    params: "1.4M params",
    confusion: { tn: 18367, fp: 185, fn: 227, tp: 4221 },
    advantages: ["Instance-level feature masks are natively explainable", "Sparse, compact decisions"],
    limitations: ["Sensitive to learning-rate schedule", "Longer training cycles"],
  },
];

export const modelById = (id: string) => MODELS.find((m) => m.id === id);

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
  { key: "in_out_ratio", label: "In / out value ratio", importance: 0.21, shap: 0.34, value: "8.42" },
  { key: "avg_time_between", label: "Avg. time between txns", importance: 0.17, shap: -0.19, value: "38s" },
  { key: "unique_counterparties", label: "Unique counterparties", importance: 0.14, shap: 0.27, value: "126" },
  { key: "gas_anomaly", label: "Gas price anomaly", importance: 0.12, shap: 0.16, value: "+3.1σ" },
  { key: "contract_age", label: "Counterparty contract age", importance: 0.1, shap: -0.12, value: "4 days" },
  { key: "tx_burst", label: "Burst transaction count", importance: 0.09, shap: 0.22, value: "47 / 10m" },
  { key: "mixer_proximity", label: "Mixer proximity (hops)", importance: 0.09, shap: 0.29, value: "2" },
  { key: "erc20_diversity", label: "ERC-20 token diversity", importance: 0.08, shap: -0.07, value: "19" },
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

const HASH_CHARS = "0123456789abcdef";
export const randomHash = (len = 64) =>
  "0x" +
  Array.from({ length: len }, () => HASH_CHARS[Math.floor(Math.random() * 16)]).join("");

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

export const makeTxn = (block: number): Txn => {
  const risk = Math.random() < 0.14 ? 60 + Math.random() * 40 : Math.random() * 55;
  return {
    hash: randomHash(),
    from: randomHash(40),
    to: randomHash(40),
    value: Number((Math.random() * 42).toFixed(4)),
    gas: Number((Math.random() * 60 + 8).toFixed(1)),
    block,
    risk: Number(risk.toFixed(1)),
    level: levelFromRisk(risk),
    ts: Date.now(),
  };
};

const HISTORY_RISKS = [88.4, 12.1, 64.9, 91.2, 7.4, 41.6, 22.8, 77.3, 5.9, 33.2, 96.1, 18.7, 52.4, 9.8];
const MODES = ["Hash", "Batch", "Manual", "Consensus"] as const;

export const HISTORY = HISTORY_RISKS.map((risk, i) => ({
  id: `AN-${4820 - i}`,
  hash: randomHash(),
  model: MODELS[i % MODELS.length]!.name,
  risk,
  level: levelFromRisk(risk),
  confidence: Number((0.72 + Math.random() * 0.27).toFixed(3)),
  mode: MODES[i % 4]!,
  at: new Date(Date.now() - i * 5400000).toISOString(),
}));

