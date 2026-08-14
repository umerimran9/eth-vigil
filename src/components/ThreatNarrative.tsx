import { Panel, RiskBadge } from "@/components/ui-kit";
import { levelFromVerdict, verdictLabel } from "@/lib/platform-data";
import type { AnalysisRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

// Real feature names -> plain-English phrasing. Covers the heuristic
// explainer's hardcoded importance table (registry.py:explain_prediction);
// anything outside that table falls back to a de-snaked raw name rather
// than a made-up description.
const LABELS: Record<string, string> = {
  erc_20_Symbol_End_Is_Digit: "the wallet's held token symbol ends in a digit",
  gas_efficiency: "gas efficiency (gas used vs. gas limit)",
  gas_efficiency_era_rel: "gas efficiency relative to the recent chain-era baseline",
  cumulative_gas_used: "cumulative gas used in the block",
  cumulative_gas_used_era_rel: "cumulative gas used relative to the recent chain-era baseline",
  erc_20_Name_Has_Digit: "the wallet's held token name contains a digit",
  erc_20_Name_Has_Digit_era_rel: "token-name-digit signal relative to the recent chain-era baseline",
  effective_gas_price: "the effective gas price paid",
  total_gas_cost: "total gas cost",
  value: "the transferred ETH value",
  is_same_address: "sender and receiver being the same address",
  length_to: "recipient address length",
  gas_used: "raw gas used",
};

const labelFor = (feature: string) => LABELS[feature] ?? feature.replace(/_/g, " ").toLowerCase();

// Human-readable read of the heuristic feature-signal table (NOT real SHAP
// -- see registry.py:explain_prediction's docstring and the disclosure line
// at the bottom of this component).
export function ThreatNarrative({ record }: { record: AnalysisRecord }) {
  const level = levelFromVerdict(record.verdict, record.risk);
  const tone = level === "high" ? "text-risk" : level === "elevated" ? "text-warn" : "text-safe";
  const top = record.featureSignals.slice(0, 5);

  return (
    <Panel>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Threat assessment</h2>
        <RiskBadge level={level} />
      </div>
      <div className={cn("mt-2 text-2xl font-bold", tone)}>{verdictLabel(record.verdict)}</div>

      <h3 className="mt-5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Primary signals</h3>
      {top.length > 0 ? (
        <ul className="mt-2.5 space-y-2 text-sm text-muted-foreground">
          {top.map((f) => (
            <li key={f.feature} className="flex items-start gap-2">
              <span className={f.signal_value > 0 ? "text-risk" : "text-safe"}>{f.signal_value > 0 ? "▲" : "▼"}</span>
              {labelFor(f.feature)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2.5 text-sm text-muted-foreground">No signals were returned for this transaction.</p>
      )}

      <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
        These signals come from a fixed importance-weight table, not a per-model Shapley-value (SHAP)
        computation — see the raw values in Analyst mode.
      </p>
    </Panel>
  );
}
