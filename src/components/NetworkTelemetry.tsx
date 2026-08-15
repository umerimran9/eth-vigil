import { useNetworkState } from "@/lib/network-state";
import { TelemetryCell } from "@/components/web3";

/**
 * Persistent network state, presented as chain telemetry rather than four
 * metric cards: one bordered strip of mono read-outs whose first cell is the
 * chain identity itself.
 */
export function NetworkTelemetry({
  modelsOnline = 7,
  lastScanLabel,
  flagged,
}: {
  modelsOnline?: number | undefined;
  lastScanLabel?: string | undefined;
  flagged?: number | undefined;
}) {
  const net = useNetworkState();

  return (
    <section className="rounded-md border border-border bg-card" aria-label="Ethereum network state">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-safe" />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider">
            {net.chain}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            chain id 1 · consensus layer synced
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-safe">
          network healthy
        </span>
      </div>

      <div className="grid grid-cols-2 divide-border sm:grid-cols-3 lg:grid-cols-5">
        <TelemetryCell
          label="head block"
          value={net.blockLabel}
          hint={`~12s cadence · ${net.baseFeeGwei.toFixed(1)} gwei base fee`}
        />
        <TelemetryCell label="detection engine" value="Active" tone="safe" hint="inline scoring" />
        <TelemetryCell
          label="ai models"
          value={`${modelsOnline} online`}
          hint="ensemble consensus"
        />
        <TelemetryCell
          label="latest scan"
          value={lastScanLabel ?? "—"}
          hint="most recent verdict"
        />
        <TelemetryCell
          label="flagged threats"
          value={flagged !== undefined ? String(flagged) : "—"}
          tone={flagged ? "risk" : undefined}
          hint="high-risk this session"
        />
      </div>
    </section>
  );
}
