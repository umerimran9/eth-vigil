import { Link } from "@tanstack/react-router";
import { Copy, GitCompare, SearchCode } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { RiskBadge, short } from "@/components/ui-kit";
import { actionLabel, levelFromVerdict, verdictLabel } from "@/lib/platform-data";
import type { AnalysisRecord } from "@/lib/types";

// Partial<AnalysisRecord>, but with every optional field explicitly allowing
// `undefined` as a value (not just an absent key) -- callers (Monitor,
// History) build these from payloads where some fields are genuinely
// missing, and exactOptionalPropertyTypes requires that to be spelled out.
export type DrawerRecord = { [K in keyof AnalysisRecord]?: AnalysisRecord[K] | undefined } & {
  hash?: string | undefined;
};

interface InvestigationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: DrawerRecord | null;
  onCompare?: (record: DrawerRecord) => void;
  /** e.g. "Per-model breakdown isn't available for batch rows." -- shown
   * honestly instead of fabricating detail the source data doesn't have. */
  limitedNote?: string;
}

// Right-side summary of one analysis, reachable from History/Monitor/Batch
// without leaving the current page. Every field is read defensively --
// callers pass whatever real data they actually have (History rows carry
// the full record post-backend-change; Monitor rows carry model_scores but
// not the full feature vector; Batch rows carry only risk/verdict) and any
// missing piece renders as an honest gap, not an invented value.
export function InvestigationDrawer({ open, onOpenChange, record, onCompare, limitedNote }: InvestigationDrawerProps) {
  if (!record) return null;

  const level = record.verdict ? levelFromVerdict(record.verdict, record.risk) : "safe";
  const tx = record.transaction;
  const canInvestigate = Boolean(tx?.from_address);

  const copyHash = () => {
    if (record.hash || tx?.hash) {
      navigator.clipboard?.writeText(record.hash || tx!.hash).then(() => toast.success("Hash copied"));
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto border-l border-border bg-background p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border p-6 text-left">
          <SheetTitle className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Investigation
          </SheetTitle>
          <SheetDescription className="break-all font-mono text-xs text-foreground">
            {short(record.hash || tx?.hash || "unknown")}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 p-6">
          {record.verdict ? (
            <div>
              <span className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">Verdict</span>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="text-2xl font-bold">{verdictLabel(record.verdict)}</div>
                <RiskBadge level={level} />
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Verdict not available for this record.</p>
          )}

          <div>
            <h3 className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">Risk &amp; consensus</h3>
            <div className="mt-2 grid grid-cols-2 gap-4">
              <div>
                <div className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">Risk</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{record.risk ?? "—"}</div>
              </div>
              {record.agreedModels !== undefined && record.totalModels !== undefined ? (
                <div>
                  <div className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">Agreement</div>
                  <div className="mt-1 text-lg font-semibold tabular-nums">
                    {record.agreedModels}/{record.totalModels}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {record.action ? (
            <div>
              <h3 className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">Action</h3>
              <span className="mt-2 inline-flex rounded-full card-flat px-3 py-1 text-xs font-medium uppercase tracking-wider">
                {actionLabel(record.action)}
              </span>
            </div>
          ) : null}

          {record.modelScores && record.modelScores.length > 0 ? (
            <div>
              <h3 className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">Model summary</h3>
              <ul className="mt-2 space-y-1.5">
                {record.modelScores.map((m) => (
                  <li key={m.model_id} className="flex items-center justify-between text-xs">
                    <span>{m.name}</span>
                    <span className={m.verdict === "FRAUD" ? "text-risk" : "text-safe"}>
                      {m.verdict === "FRAUD" ? "fraud" : "clear"} · {(m.probability * 100).toFixed(0)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {record.shapParagraph ? (
            <div>
              <h3 className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">SHAP Explainability Finding</h3>
              <p className="mt-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-foreground">
                {record.shapParagraph}
              </p>
            </div>
          ) : null}

          {record.featureSignals && record.featureSignals.length > 0 ? (
            <div>
              <h3 className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">Key Feature Attribution Signals</h3>
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                {record.featureSignals.slice(0, 3).map((f) => (
                  <li key={f.feature} className="flex items-center justify-between">
                    <span>{f.feature}</span>
                    <span className={f.signal_value > 0 ? "font-mono font-bold text-risk" : "font-mono font-bold text-safe"}>
                      {f.signal_value > 0 ? "+" : ""}{f.signal_value.toFixed(3)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {tx ? (
            <div>
              <h3 className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">Transaction</h3>
              <dl className="mt-2 space-y-2 text-xs">
                {(
                  [
                    ["From", tx.from_address],
                    ["To", tx.to_address ?? "Contract creation"],
                    ["Value", `${tx.value_eth} ETH`],
                    ["Gas used", tx.gas_used?.toLocaleString?.() ?? String(tx.gas_used)],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex gap-3">
                    <dt className="w-16 shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">{k}</dt>
                    <dd className="break-all font-mono">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          {limitedNote ? <p className="text-[11px] text-muted-foreground">{limitedNote}</p> : null}

          <div className="flex flex-wrap gap-2 border-t border-border pt-5">
            {canInvestigate ? (
              <Link
                to="/detect"
                search={{ from: tx!.from_address, to: tx!.to_address ?? "", value: String(tx!.value_eth) }}
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background transition hover:scale-[1.02]"
              >
                <SearchCode className="h-3.5 w-3.5" /> Open full investigation
              </Link>
            ) : null}
            {onCompare ? (
              <button
                onClick={() => onCompare(record)}
                className="inline-flex items-center gap-1.5 rounded-full card-flat px-4 py-2 text-xs font-medium transition hover:bg-accent"
              >
                <GitCompare className="h-3.5 w-3.5" /> Compare
              </button>
            ) : null}
            <button
              onClick={copyHash}
              className="inline-flex items-center gap-1.5 rounded-full card-flat px-4 py-2 text-xs font-medium transition hover:bg-accent"
            >
              <Copy className="h-3.5 w-3.5" /> Copy hash
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
