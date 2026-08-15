// Shared shapes for a completed analysis, used by /detect, the Investigation
// Drawer, Evidence Stack, Transaction Comparison, and History. Mirrors the
// real backend response from POST /api/v1/transactions/analyze (see
// COMPLETE_SYSTEM_DOCUMENTATION.md §35) -- every field here traces to a real
// API field, none are invented for display purposes.

export interface ModelScore {
  model_id: string;
  name: string;
  probability: number;
  threshold: number;
  verdict: string;
}

export interface TransactionMeta {
  hash: string;
  block_number: number;
  timestamp: number;
  from_address: string;
  to_address: string | null;
  value_eth: number;
  gas_used: number;
  effective_gas_price_gwei: number;
}

// The heuristic explainer's top-6 output (registry.py:explain_prediction).
// NOT real SHAP -- see that function's docstring. `signal_value` was
// `shap_value` before this pass; renamed at the API level to stop implying
// a Shapley-value computation that isn't happening.
export interface FeatureSignal {
  feature: string;
  value: number;
  signal_value: number;
  label?: string;
  description: string;
}

// The full ordered 61-feature vector (new in this pass, `raw_features` on
// the analyze response) -- every real computed feature, not just the
// heuristic explainer's top 6.
export interface RawFeature {
  feature: string;
  value: number;
}

export interface AnalysisRecord {
  id?: string;
  verdict: string;
  action: string;
  risk: number; // 0-100
  confidence: number; // 0-1, model agreement
  agreedModels: number;
  totalModels: number;
  recommendations: string[];
  featureSignals: FeatureSignal[];
  rawFeatures: RawFeature[];
  featuresDefaulted: boolean;
  modelScores: ModelScore[];
  transaction: TransactionMeta | null;
  shapParagraph?: string;
  at?: string;
}

// Real feature-name prefixes from blocksoc_features/feature_order.json --
// used to group raw_features into honest categories (Evidence Stack,
// Transaction DNA). Every feature falls into exactly one of these; nothing
// here is a fabricated taxonomy, it's the real column-name structure.
export function categorizeFeature(name: string): "token" | "gas" | "temporal" | "transaction" {
  if (name.startsWith("erc_20_") || name.startsWith("erc_721_")) return "token";
  if (name.endsWith("_era_rel")) return "temporal";
  if (["gas_used", "gas_efficiency", "effective_gas_price", "total_gas_cost", "gas_price_ratio"].includes(name)) {
    return "gas";
  }
  return "transaction";
}
