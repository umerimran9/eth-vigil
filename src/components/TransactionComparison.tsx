import { X } from "lucide-react";
import { Panel, RiskBadge, Meter, short } from "@/components/ui-kit";
import { levelFromVerdict, verdictLabel } from "@/lib/platform-data";
import type { DrawerRecord } from "@/components/InvestigationDrawer";

function NumberRow({ label, a, b, unit = "" }: { label: string; a: number | undefined; b: number | undefined; unit?: string }) {
  const max = Math.max(Math.abs(a ?? 0), Math.abs(b ?? 0), 1);
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-4 py-2.5">
      <div className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="grid grid-cols-2 gap-6 text-right">
        {[a, b].map((v, i) => (
          <div key={i}>
            <div className="font-mono text-xs tabular-nums">{v !== undefined ? `${v}${unit}` : "Not available"}</div>
            {v !== undefined ? <div className="mt-1"><Meter value={(Math.abs(v) / max) * 100} tone={i === 0 ? "cyan-accent" : "violet-accent"} /></div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// Compares two real analysis records field by field. Any field either side
// doesn't have shows "Not available" rather than a guessed value — records
// can come from History (rich, post-backend-change), a fresh /detect run,
// or Monitor (partial), and this component never assumes more depth than
// what it's actually handed.
export function TransactionComparison({ a, b, onClear }: { a: DrawerRecord | null; b: DrawerRecord | null; onClear: () => void }) {
  if (!a && !b) return null;

  return (
    <Panel delay={0.1}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Comparison</h2>
        <button onClick={onClear} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
          <X className="h-3 w-3" /> Clear
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-6">
        {[a, b].map((r, i) => (
          <div key={i}>
            <div className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Transaction {i === 0 ? "A" : "B"}
            </div>
            {r ? (
              <>
                <div className="mt-1 break-all font-mono text-[11px]">{short(r.hash || r.transaction?.hash || "unknown")}</div>
                {r.verdict ? <RiskBadge level={levelFromVerdict(r.verdict, r.risk)} label={verdictLabel(r.verdict)} /> : null}
              </>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Select a second transaction to compare.</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-2 divide-y divide-white/6">
        <NumberRow label="Risk score" a={a?.risk} b={b?.risk} />
        <NumberRow label="Agreement" a={a?.agreedModels} b={b?.agreedModels} unit={a?.totalModels ? `/${a.totalModels}` : ""} />
        <NumberRow label="Value (ETH)" a={a?.transaction?.value_eth} b={b?.transaction?.value_eth} />
        <NumberRow label="Gas used" a={a?.transaction?.gas_used} b={b?.transaction?.gas_used} />
        <NumberRow label="Gas price (gwei)" a={a?.transaction?.effective_gas_price_gwei} b={b?.transaction?.effective_gas_price_gwei} />
      </div>

      {a?.modelScores && b?.modelScores ? (
        <div className="mt-4">
          <h3 className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">Model verdicts</h3>
          <div className="mt-2 divide-y divide-white/6">
            {a.modelScores.map((ma) => {
              const mb = b.modelScores!.find((m) => m.model_id === ma.model_id);
              return (
                <div key={ma.model_id} className="grid grid-cols-[1fr_auto] items-center gap-4 py-2 text-xs">
                  <span>{ma.name}</span>
                  <div className="grid grid-cols-2 gap-6 text-right font-mono tabular-nums">
                    <span className={ma.verdict === "FRAUD" ? "text-risk" : "text-safe"}>{(ma.probability * 100).toFixed(0)}%</span>
                    <span className={mb ? (mb.verdict === "FRAUD" ? "text-risk" : "text-safe") : "text-muted-foreground"}>
                      {mb ? `${(mb.probability * 100).toFixed(0)}%` : "Not available"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
