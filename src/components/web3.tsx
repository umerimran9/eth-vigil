import { useState, type ReactNode } from "react";
import { Check, Copy, ExternalLink, FileCode2, Wallet, Boxes, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBlock } from "@/lib/network-state";

// Web3-native display primitives. Everything an analyst reads on-chain --
// hashes, addresses, blocks, gas, values, entity types -- has one canonical
// representation here so addresses never visually overwhelm a dense screen
// and every one of them is copyable.

export const truncateHex = (v: string, lead = 6, tail = 4) =>
  v.length > lead + tail + 3 ? `${v.slice(0, lead)}…${v.slice(-tail)}` : v;

export type EntityKind = "transaction" | "wallet" | "contract" | "block" | "entity";

const KIND_META: Record<EntityKind, { label: string; icon: typeof Wallet }> = {
  transaction: { label: "TX", icon: ArrowRight },
  wallet: { label: "WALLET", icon: Wallet },
  contract: { label: "CONTRACT", icon: FileCode2 },
  block: { label: "BLOCK", icon: Boxes },
  entity: { label: "ENTITY", icon: Wallet },
};

export function EntityBadge({ kind, className }: { kind: EntityKind; className?: string }) {
  const meta = KIND_META[kind];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-sm border border-border bg-secondary px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground",
        className,
      )}
    >
      <meta.icon className="h-2.5 w-2.5" />
      {meta.label}
    </span>
  );
}

/** Copyable hex chip for a hash, wallet, or contract address. */
export function HexChip({
  value,
  kind,
  lead = 6,
  tail = 4,
  href,
  className,
}: {
  value: string;
  kind?: EntityKind | undefined;
  lead?: number | undefined;
  tail?: number | undefined;
  href?: string | undefined;
  className?: string | undefined;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <span
      className={cn(
        "group inline-flex min-w-0 items-center gap-1.5 rounded-sm border border-border/70 bg-secondary/50 px-1.5 py-0.5",
        className,
      )}
    >
      {kind ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" /> : null}
      <span className="truncate font-mono text-[11px] text-foreground" title={value}>
        {truncateHex(value, lead, tail)}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : `Copy ${value}`}
        className="shrink-0 text-muted-foreground transition hover:text-foreground"
      >
        {copied ? <Check className="h-3 w-3 text-safe" /> : <Copy className="h-3 w-3" />}
      </button>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label="Open in explorer"
          className="shrink-0 text-muted-foreground transition hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </span>
  );
}

export function BlockRef({ block, className }: { block: number; className?: string }) {
  return (
    <span className={cn("font-mono text-[11px] tabular-nums text-foreground", className)}>
      {formatBlock(block)}
    </span>
  );
}

/** Severity scale from the security brief: normal → critical. */
export type Severity = "normal" | "low" | "medium" | "high" | "critical";

export function severityFromRisk(risk: number): Severity {
  if (risk >= 85) return "critical";
  if (risk >= 70) return "high";
  if (risk >= 45) return "medium";
  if (risk >= 25) return "low";
  return "normal";
}

export const SEVERITY_STYLE: Record<Severity, string> = {
  normal: "border-safe/25 bg-safe/10 text-safe",
  low: "border-border bg-secondary text-muted-foreground",
  medium: "border-warn/25 bg-warn/10 text-warn",
  high: "border-warn/40 bg-warn/15 text-warn",
  critical: "border-risk/30 bg-risk/10 text-risk",
};

export const SEVERITY_TEXT: Record<Severity, string> = {
  normal: "text-safe",
  low: "text-muted-foreground",
  medium: "text-warn",
  high: "text-warn",
  critical: "text-risk",
};

export function SeverityTag({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-sm border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider",
        SEVERITY_STYLE[severity],
        className,
      )}
    >
      {severity}
    </span>
  );
}

/**
 * Risk read-out. Deliberately typographic -- a number, a severity word and a
 * confidence figure -- instead of a glowing gauge.
 */
export function RiskScore({
  risk,
  confidence,
  className,
}: {
  risk: number;
  confidence?: number | undefined;
  className?: string | undefined;
}) {
  const sev = severityFromRisk(risk);
  return (
    <div className={cn("flex items-end gap-3", className)}>
      <div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Risk score
        </div>
        <div className={cn("font-mono text-3xl font-semibold tabular-nums", SEVERITY_TEXT[sev])}>
          {Math.round(risk)}
          <span className="text-sm text-muted-foreground">/100</span>
        </div>
      </div>
      <div className="pb-1">
        <SeverityTag severity={sev} />
        {confidence !== undefined ? (
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">
            Confidence {Math.round(confidence * 100)}%
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Compact telemetry cell used for the network state strip. */
export function TelemetryCell({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode | undefined;
  tone?: "safe" | "risk" | "warn" | undefined;
}) {
  return (
    <div className="border-border px-4 py-3 first:pl-0 sm:border-l sm:first:border-l-0">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-mono text-sm font-semibold tabular-nums",
          tone === "safe" && "text-safe",
          tone === "risk" && "text-risk",
          tone === "warn" && "text-warn",
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

/** Wallet → Contract → Wallet path, rendered as a trace rather than a diagram. */
export function FlowPath({
  steps,
}: {
  steps: Array<{ kind: EntityKind; address: string; note?: string | undefined }>;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
      {steps.map((s, i) => (
        <li key={`${s.address}-${i}`} className="flex items-center gap-2">
          <span className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5">
              <EntityBadge kind={s.kind} />
              <HexChip value={s.address} />
            </span>
            {s.note ? (
              <span className="pl-1 text-[10px] text-muted-foreground">{s.note}</span>
            ) : null}
          </span>
          {i < steps.length - 1 ? (
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : null}
        </li>
      ))}
    </ol>
  );
}
