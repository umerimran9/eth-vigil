import { Link } from "@tanstack/react-router";
import { EmptyState, SkeletonRows } from "@/components/ui-kit";
import { EntityBadge, HexChip, SEVERITY_TEXT, SeverityTag, severityFromRisk } from "@/components/web3";
import { verdictLabel } from "@/lib/platform-data";

export interface ThreatRow {
  id: string;
  hash: string;
  verdict: string;
  risk: number;
  from?: string | undefined;
  to?: string | undefined;
  value?: string | number | undefined;
  at?: string | undefined;
}

const timeAgo = (iso?: string | undefined) => {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "—";
  const m = Math.max(0, Math.round(diff / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};

/**
 * The chain-native replacement for a generic "recent items" table: an
 * append-ordered scan log where every row names the on-chain objects it
 * touched, the severity assigned, and the route into the full investigation.
 */
export function LiveThreatFeed({
  rows,
  loading = false,
}: {
  rows: ThreatRow[];
  loading?: boolean | undefined;
}) {
  return (
    <section className="overflow-hidden rounded-md border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-safe" />
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wider">
            Live threat feed
          </h2>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          newest first
        </span>
      </div>

      {loading ? (
        <SkeletonRows rows={5} className="p-4" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No transactions scored yet"
          body="Run a detection on any mainnet transaction hash and its verdict will land here."
          action={
            <Link
              to="/detect"
              className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-primary-foreground"
            >
              Investigate a transaction
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => {
            const sev = severityFromRisk(r.risk);
            return (
              <li key={r.id} className="group grid gap-2 px-4 py-3 transition hover:bg-secondary/40 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <EntityBadge kind="transaction" />
                  <HexChip value={r.hash} lead={10} tail={6} />
                  {r.from ? (
                    <span className="hidden items-center gap-1.5 xl:flex">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        from
                      </span>
                      <HexChip value={r.from} kind="wallet" />
                    </span>
                  ) : null}
                  {r.to ? (
                    <span className="hidden items-center gap-1.5 xl:flex">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        to
                      </span>
                      <HexChip value={r.to} kind="wallet" />
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center justify-between gap-4 lg:justify-end">
                  {r.value !== undefined ? (
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      {r.value} ETH
                    </span>
                  ) : null}
                  <span className="font-mono text-[10px] text-muted-foreground">{timeAgo(r.at)}</span>
                  <span className={`w-28 text-right font-mono text-[11px] font-semibold ${SEVERITY_TEXT[sev]}`}>
                    {verdictLabel(r.verdict)}
                  </span>
                  <span className={`w-10 text-right font-mono text-sm font-semibold tabular-nums ${SEVERITY_TEXT[sev]}`}>
                    {Math.round(r.risk)}
                  </span>
                  <SeverityTag severity={sev} />
                  <Link
                    to="/detect"
                    search={{ hash: r.hash, aegisRun: true }}
                    className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline"
                  >
                    trace
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
