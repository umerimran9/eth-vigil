import { useState, type ReactNode } from "react";
import { AlertTriangle, ChevronDown, Copy } from "lucide-react";
import { toast } from "sonner";
import { RiskBadge } from "@/components/ui-kit";
import { actionLabel, levelFromVerdict } from "@/lib/platform-data";
import { cn } from "@/lib/utils";
import { categorizeFeature, type AnalysisRecord } from "@/lib/types";

const copyText = (text: string, label: string) => {
  navigator.clipboard?.writeText(text).then(() => toast.success(`${label} copied`));
};

function SignalCard({
  index,
  title,
  summary,
  tone = "neutral",
  defaultOpen = false,
  children,
}: {
  index: string;
  title: string;
  summary: string;
  tone?: "safe" | "warn" | "risk" | "neutral";
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const dot = { safe: "bg-safe", warn: "bg-warn", risk: "bg-risk", neutral: "bg-muted-foreground/40" }[tone];

  return (
    <div className="card-flat overflow-hidden rounded-lg">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-4 p-4 text-left transition hover:bg-accent/40"
        aria-expanded={open}
      >
        <div className="flex items-start gap-3">
          <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dot)} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs tabular-nums text-muted-foreground">{index}</span>
              <span className="text-sm font-medium">{title}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{summary}</p>
          </div>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open ? "rotate-180" : "")} />
      </button>
      {open ? <div className="border-t border-border px-4 py-3.5">{children}</div> : null}
    </div>
  );
}

// Real evidence, presented as distinct signal cards -- every value traces to
// a real response field (transaction, raw_features grouped by real
// feature-name prefixes, consensus, recommendations). Anything not present
// shows "Not available," never a filled-in guess. Model consensus lives in
// its own Consensus Core tab now, not buried here as a sixth card.
export function EvidenceStack({ record }: { record: AnalysisRecord }) {
  const tokenFeatures = record.rawFeatures.filter((f) => categorizeFeature(f.feature) === "token" && f.value !== 0);
  const gasFeatures = record.rawFeatures.filter((f) => categorizeFeature(f.feature) === "gas");
  const temporalFeatures = record.rawFeatures.filter((f) => categorizeFeature(f.feature) === "temporal");
  const behaviorFeatures = [...gasFeatures, ...temporalFeatures];
  const level = levelFromVerdict(record.verdict, record.risk);

  const tokenSummary = record.featuresDefaulted
    ? "No real token history found for this wallet."
    : tokenFeatures.length > 0
      ? `${tokenFeatures.length} non-zero token signal${tokenFeatures.length === 1 ? "" : "s"}.`
      : "No non-zero token signals for this wallet.";

  return (
    <div className="space-y-3">
      <SignalCard
        index="01"
        title="Transaction"
        summary={record.transaction ? `${record.transaction.value_eth} ETH · gas ${record.transaction.gas_used.toLocaleString()}` : "Not available."}
        tone="neutral"
        defaultOpen
      >
        {record.transaction ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["Hash", record.transaction.hash, record.transaction.hash],
                ["Block", `#${record.transaction.block_number.toLocaleString()}`, null],
                ["From", record.transaction.from_address, record.transaction.from_address],
                ["To", record.transaction.to_address ?? "Contract creation", record.transaction.to_address],
                ["Value", `${record.transaction.value_eth} ETH`, null],
                ["Gas used", record.transaction.gas_used.toLocaleString(), null],
              ] as const
            ).map(([label, value, copyVal]) => (
              <div key={label}>
                <dt className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
                <dd className="mt-1 flex items-center gap-1.5 break-all font-mono text-xs">
                  {value}
                  {copyVal ? (
                    <button
                      onClick={() => copyText(copyVal, label)}
                      className="shrink-0 text-muted-foreground transition hover:text-foreground"
                      aria-label={`Copy ${label}`}
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-xs text-muted-foreground">Not available.</p>
        )}
      </SignalCard>

      <SignalCard
        index="02"
        title="Token &amp; wallet signal"
        summary={tokenSummary}
        tone={record.featuresDefaulted ? "warn" : tokenFeatures.length > 0 ? "neutral" : "safe"}
      >
        {record.featuresDefaulted ? (
          <div className="flex items-center gap-2 rounded-full border border-warn/35 bg-warn/12 px-3 py-1.5 text-[11px] text-warn">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            No real token history found for this wallet — these signals defaulted to zero.
          </div>
        ) : tokenFeatures.length > 0 ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {tokenFeatures.slice(0, 14).map((f) => (
              <li key={f.feature} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">{f.feature.replace(/^erc_(20|721)_/, "")}</span>
                <span className="font-mono tabular-nums">{f.value}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No non-zero token signals for this wallet.</p>
        )}
      </SignalCard>

      <SignalCard
        index="03"
        title="Behavior — gas &amp; timing"
        summary={behaviorFeatures.length > 0 ? `${behaviorFeatures.length} features tracked.` : "Not available."}
        tone="neutral"
      >
        {behaviorFeatures.length > 0 ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {behaviorFeatures.map((f) => (
              <li key={f.feature} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">{f.feature}</span>
                <span className="font-mono tabular-nums">{f.value}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Not available.</p>
        )}
      </SignalCard>

      <SignalCard
        index="04"
        title="Consensus"
        summary={`${record.agreedModels}/${record.totalModels} models agree · mean risk ${record.risk}/100`}
        tone="neutral"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">Agreement</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {record.agreedModels} / {record.totalModels}
            </div>
          </div>
          <div>
            <div className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">Mean probability</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{record.risk}/100</div>
          </div>
        </div>
      </SignalCard>

      <SignalCard
        index="05"
        title="Decision"
        summary={actionLabel(record.action)}
        tone={level === "high" ? "risk" : level === "elevated" ? "warn" : "safe"}
        defaultOpen
      >
        <div className="flex flex-wrap items-center gap-2">
          <RiskBadge level={level} />
          <span className="rounded-full card-flat px-3 py-1 text-xs font-medium uppercase tracking-wider">
            {actionLabel(record.action)}
          </span>
        </div>
        <div className="mt-3 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
          {record.recommendations.length > 0 ? (
            record.recommendations.map((r, i) => <p key={i}>• {r}</p>)
          ) : (
            <p>No recommendation text was returned for this transaction.</p>
          )}
        </div>
      </SignalCard>
    </div>
  );
}
