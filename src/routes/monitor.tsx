import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Search,
  Blocks,
  Radio,
  Terminal,
  SearchCode,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { ModuleShell, PageHeader, Panel, RiskBadge, StatTile, short } from "@/components/ui-kit";
import { actionLabel, levelFromVerdict, MODELS, type RiskLevel, type Txn } from "@/lib/platform-data";
import { useLiveStreamStore, type LiveTxn, type WsStatus } from "@/lib/stream-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/monitor")({
  head: () => ({
    meta: [
      { title: "Live Ethereum Monitoring — Aegis" },
      {
        name: "description",
        content:
          "Stream real Ethereum blocks and transactions scored the moment they're ingested, with AI risk indicators, wallet search and instant transaction inspection.",
      },
      { property: "og:title", content: "Live Ethereum Monitoring — Aegis" },
      {
        property: "og:description",
        content: "Real-time blocks, transfers and AI risk scoring across the Ethereum mainnet.",
      },
    ],
  }),
  component: Monitor,
});

// platform-data's MODELS ids are kebab-case (UI convention); the backend's
// model_scores dict is keyed snake_case (Python convention). Same six models.
const toBackendId = (id: string) => id.replace(/-/g, "_");

const copyToClipboard = (text: string, label: string) => {
  navigator.clipboard?.writeText(text).then(() => toast.success(`${label} copied to clipboard`));
};

function Monitor() {
  const { block, recentBlocks, txns, wsStatus, live, toggleLive } = useLiveStreamStore();
  const [query, setQuery] = useState("");
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null);
  const [expandedHash, setExpandedHash] = useState<string | null>(null);
  const [viewModel, setViewModel] = useState<string>("consensus");

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Re-derives risk/level for the selected view
  const displayFor = (t: LiveTxn): { risk: number; level: RiskLevel } => {
    if (viewModel === "consensus") return { risk: t.risk, level: t.level };
    const m = t.modelScores?.[toBackendId(viewModel)];
    if (!m) return { risk: t.risk, level: t.level };
    const risk = Number((m.probability * 100).toFixed(1));
    return { risk, level: levelFromVerdict(m.verdict, risk) };
  };

  const filtered = useMemo(() => {
    let list = txns;
    if (selectedBlock !== null) {
      list = list.filter((t) => t.block === selectedBlock);
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (t) =>
        t.hash.toLowerCase().includes(q) ||
        t.from.toLowerCase().includes(q) ||
        t.to.toLowerCase().includes(q) ||
        String(t.block).includes(q),
    );
  }, [txns, query, selectedBlock]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  // Ensure current page is valid
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [totalPages, page]);

  const paginatedTxns = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const flagged = txns.filter((t) => displayFor(t).level !== "safe").length;

  const statusMeta: Record<WsStatus, { label: string; dot: string }> = {
    connecting: { label: "Connecting…", dot: "text-muted-foreground" },
    connected: { label: "Live", dot: "text-safe" },
    waiting: { label: "Waiting for blocks…", dot: "text-warn" },
    disconnected: { label: "Disconnected", dot: "text-risk" },
  };
  const status = live ? statusMeta[wsStatus] : { label: "Paused", dot: "text-muted-foreground" };
  const needsIngestHint = live && (wsStatus === "waiting" || wsStatus === "disconnected");

  const toggleExpand = (hash: string) => {
    setExpandedHash((prev) => (prev === hash ? null : hash));
  };

  return (
    <ModuleShell>
      <PageHeader
        eyebrow="Live blockchain monitoring"
        title="The chain, as it happens."
        description="Real Ethereum transactions scored instantly by the 6-model ensemble. Expand any row to inspect deep forensic parameters or run SHAP explainability."
        aside={
          <button
            onClick={toggleLive}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-[#111c38] px-5 py-2.5 text-sm font-medium text-foreground transition hover:border-primary"
          >
            <Radio className={`h-4 w-4 ${status.dot}`} />
            {status.label}
          </button>
        }
      />

      {needsIngestHint ? (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-warn/40 bg-warn/10 px-5 py-4 text-xs text-warn">
          <Terminal className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">
              {wsStatus === "disconnected" ? "No live feed connected." : "Connected, but no transactions received yet."}
            </p>
            <p className="mt-1 text-warn/80">
              Start the ingest worker alongside the API server: <code className="font-mono">python
              tools/live_ingest_etherscan.py</code> (requires <code className="font-mono">ETHERSCAN_API_KEY</code>{" "}
              in <code className="font-mono">.env</code>).
            </p>
          </div>
        </div>
      ) : null}

      {/* Top 4 Stat Tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Latest block"
          value={block ? `#${block.toLocaleString()}` : "—"}
          sub="~12s cadence"
          accent="cyan"
        />
        <StatTile label="Txns in buffer" value={String(txns.length)} sub="rolling memory" delay={0.05} />
        <StatTile
          label="Flagged"
          value={String(flagged)}
          sub={viewModel === "consensus" ? "elevated or high risk" : `by ${MODELS.find((m) => m.id === viewModel)?.name}`}
          accent="risk"
          delay={0.1}
        />
        <StatTile
          label={viewModel === "consensus" ? "Ensemble" : "Active Model"}
          value={viewModel === "consensus" ? `${MODELS.length} models` : (MODELS.find((m) => m.id === viewModel)?.name ?? viewModel)}
          sub={viewModel === "consensus" ? "scoring every ingested tx" : `${MODELS.find((m) => m.id === viewModel)?.family || "Single Model"} view`}
          accent={viewModel === "consensus" ? "safe" : "cyan"}
          delay={0.15}
        />
      </div>

      {/* Latest Blocks Top Bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mr-1">
            <Blocks className="h-3.5 w-3.5 text-primary" />
            <span>Latest Blocks:</span>
          </div>
          {recentBlocks.length === 0 ? (
            <span className="font-mono text-xs text-muted-foreground">Waiting for blocks…</span>
          ) : (
            recentBlocks.map((b) => {
              const count = txns.filter((t) => t.block === b).length;
              const isSelected = selectedBlock === b;
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => setSelectedBlock((prev) => (prev === b ? null : b))}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg border px-3 py-1 font-mono text-xs transition",
                    isSelected
                      ? "border-primary bg-primary/20 text-foreground"
                      : "border-border bg-[#0e1832] text-muted-foreground hover:border-primary/50 hover:text-foreground",
                  )}
                >
                  <span className="font-semibold text-foreground">#{b.toLocaleString()}</span>
                  <span className="text-[10px] text-muted-foreground">({count} tx)</span>
                </button>
              );
            })
          )}
        </div>

        {selectedBlock !== null && (
          <button
            type="button"
            onClick={() => setSelectedBlock(null)}
            className="font-mono text-[11px] text-cyan hover:underline"
          >
            Clear Block Filter
          </button>
        )}
      </div>

      {/* Scoring Model Selector Pills */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="View risk by model">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mr-1">
            Scoring View:
          </span>
          <button
            role="tab"
            aria-selected={viewModel === "consensus"}
            onClick={() => setViewModel("consensus")}
            className={cn(
              "rounded-lg border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition",
              viewModel === "consensus"
                ? "border-primary bg-primary/20 text-foreground font-semibold"
                : "border-border bg-[#0e1832] text-muted-foreground hover:border-primary/50 hover:text-foreground",
            )}
          >
            Consensus
          </button>
          {MODELS.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={viewModel === m.id}
              onClick={() => setViewModel(m.id)}
              className={cn(
                "rounded-lg border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition",
                viewModel === m.id
                  ? "border-primary bg-primary/20 text-foreground font-semibold"
                  : "border-border bg-[#0e1832] text-muted-foreground hover:border-primary/50 hover:text-foreground",
              )}
            >
              {m.name}
            </button>
          ))}
        </div>

        {/* Page size selector */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Per Page:
          </span>
          <div className="flex gap-1">
            {[10, 20, 50].map((sz) => (
              <button
                key={sz}
                onClick={() => {
                  setPageSize(sz);
                  setPage(1);
                }}
                className={cn(
                  "rounded-md border px-2.5 py-0.5 font-mono text-xs transition",
                  pageSize === sz
                    ? "border-primary bg-primary/20 text-foreground font-semibold"
                    : "border-border bg-[#0e1832] text-muted-foreground hover:border-primary/50 hover:text-foreground",
                )}
              >
                {sz}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Full-Width Live Transactions Table */}
      <Panel delay={0.1} className="mt-4 p-0 overflow-hidden">
        {/* Table Search Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-[#0e1832] px-6 py-3.5">
          <div className="flex flex-1 items-center gap-3 min-w-[240px]">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search wallet address, tx hash, or block height…"
              className="w-full bg-transparent font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          <span className="font-mono text-[11px] text-muted-foreground shrink-0">
            {filtered.length} total transactions
          </span>
        </div>

        {/* Table Column Headers */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-[#0e1832]/60 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="px-5 py-3 font-semibold">Txn Hash</th>
                <th className="px-4 py-3 font-semibold">Block</th>
                <th className="px-4 py-3 font-semibold">From (Sender)</th>
                <th className="px-4 py-3 font-semibold">To (Contract / Recipient)</th>
                <th className="px-4 py-3 font-semibold text-right">Value (ETH)</th>
                <th className="px-4 py-3 font-semibold text-right">Gas</th>
                <th className="px-4 py-3 font-semibold text-right">Risk Score</th>
                <th className="px-4 py-3 font-semibold text-center">Verdict</th>
                <th className="px-4 py-3 font-semibold text-center w-16">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {paginatedTxns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center text-xs text-muted-foreground">
                    {live
                      ? "Waiting for the first live transaction to be ingested…"
                      : "Feed paused. Click 'Live' to resume streaming."}
                  </td>
                </tr>
              ) : (
                paginatedTxns.map((t) => {
                  const d = displayFor(t);
                  const isExpanded = expandedHash === t.hash;

                  return (
                    <Fragment key={t.hash}>
                      <tr
                        onClick={() => toggleExpand(t.hash)}
                        className={cn(
                          "cursor-pointer transition hover:bg-[#152446]/60",
                          isExpanded ? "bg-[#152446]/80" : "",
                        )}
                      >
                        {/* Hash */}
                        <td className="px-5 py-3.5 font-mono text-xs text-cyan font-medium">
                          {short(t.hash, 8)}
                        </td>

                        {/* Block */}
                        <td className="px-4 py-3.5 font-mono text-xs text-foreground/80">
                          #{t.block.toLocaleString()}
                        </td>

                        {/* From */}
                        <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                          {short(t.from, 6)}
                        </td>

                        {/* To */}
                        <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                          {short(t.to, 6)}
                        </td>

                        {/* Value */}
                        <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums text-foreground">
                          {t.value.toFixed(4)} Ξ
                        </td>

                        {/* Gas */}
                        <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {t.gas.toLocaleString()}
                        </td>

                        {/* Risk Score */}
                        <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold tabular-nums text-foreground">
                          {d.risk.toFixed(1)}
                        </td>

                        {/* Verdict Badge */}
                        <td className="px-4 py-3.5 text-center">
                          <RiskBadge level={d.level} label={d.level === "safe" ? "Clear" : d.level} />
                        </td>

                        {/* Expand Action Arrow */}
                        <td className="px-4 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(t.hash);
                            }}
                            className="p-1 text-muted-foreground transition hover:text-foreground"
                            aria-label={isExpanded ? "Collapse transaction details" : "Expand transaction details"}
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-cyan" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Forensic Dropdown Drawer */}
                      {isExpanded && (
                        <tr className="bg-[#0e1832] border-b border-border">
                          <td colSpan={9} className="p-5">
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="space-y-4"
                            >
                              {t.featuresDefaulted && (
                                <div className="flex items-center gap-2 rounded-lg border border-warn/40 bg-warn/10 px-3.5 py-2 text-xs text-warn">
                                  <AlertTriangle className="h-4 w-4 shrink-0" />
                                  <span>Scored on gas/value features — sender wallet has no prior ERC-20 token history on Etherscan.</span>
                                </div>
                              )}

                              {/* Forensic Grid */}
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="rounded-lg border border-border bg-card p-3">
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                                      Full Txn Hash
                                    </span>
                                    <button
                                      onClick={() => copyToClipboard(t.hash, "Transaction Hash")}
                                      className="text-muted-foreground hover:text-cyan transition"
                                      title="Copy Hash"
                                    >
                                      <Copy className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                  <div className="mt-1 font-mono text-xs text-foreground break-all">
                                    {t.hash}
                                  </div>
                                </div>

                                <div className="rounded-lg border border-border bg-card p-3">
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                                      From Address (Sender)
                                    </span>
                                    <button
                                      onClick={() => copyToClipboard(t.from, "From Address")}
                                      className="text-muted-foreground hover:text-cyan transition"
                                      title="Copy From Address"
                                    >
                                      <Copy className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                  <div className="mt-1 font-mono text-xs text-foreground break-all">
                                    {t.from}
                                  </div>
                                </div>

                                <div className="rounded-lg border border-border bg-card p-3">
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                                      To Address (Contract)
                                    </span>
                                    <button
                                      onClick={() => copyToClipboard(t.to, "To Address")}
                                      className="text-muted-foreground hover:text-cyan transition"
                                      title="Copy To Address"
                                    >
                                      <Copy className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                  <div className="mt-1 font-mono text-xs text-foreground break-all">
                                    {t.to}
                                  </div>
                                </div>

                                <div className="rounded-lg border border-border bg-card p-3">
                                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                                    Value & Gas Metrics
                                  </span>
                                  <div className="mt-1 flex items-baseline justify-between">
                                    <span className="font-mono text-sm font-semibold text-foreground">
                                      {t.value} ETH
                                    </span>
                                    <span className="font-mono text-xs text-muted-foreground">
                                      {t.gas.toLocaleString()} gas
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Action Footer with Deep Investigation Link */}
                              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                                <div className="flex items-center gap-3">
                                  <RiskBadge level={d.level} label={`${d.risk.toFixed(1)} / 100 Risk Score`} />
                                  <span className="font-mono text-xs text-muted-foreground">
                                    Observed in Block #{t.block.toLocaleString()}
                                  </span>
                                </div>

                                <Link
                                  to="/detect"
                                  search={{
                                    from: t.from,
                                    to: t.to,
                                    value: String(t.value),
                                    gas: String(t.gas),
                                    hash: t.hash,
                                    auto: "true",
                                  }}
                                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-mono text-xs font-medium text-primary-foreground transition hover:bg-primary/90 shadow-sm"
                                >
                                  <SearchCode className="h-4 w-4" />
                                  Investigate Further (SHAP Explainability Waterfall) →
                                </Link>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Footer */}
        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-[#0e1832] px-6 py-3.5">
            <div className="font-mono text-xs text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{(page - 1) * pageSize + 1}</span>–
              <span className="font-semibold text-foreground">
                {Math.min(page * pageSize, filtered.length)}
              </span> of <span className="font-semibold text-foreground">{filtered.length}</span> transactions
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 font-mono text-xs text-foreground transition hover:border-primary disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .map((p, idx, arr) => {
                    const prevP = arr[idx - 1];
                    const hasGap = prevP && p - prevP > 1;

                    return (
                      <div key={p} className="flex items-center">
                        {hasGap && <span className="px-1 text-muted-foreground">…</span>}
                        <button
                          type="button"
                          onClick={() => setPage(p)}
                          className={cn(
                            "h-7 w-7 rounded-md border font-mono text-xs transition",
                            page === p
                              ? "border-primary bg-primary text-primary-foreground font-semibold"
                              : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
                          )}
                        >
                          {p}
                        </button>
                      </div>
                    );
                  })}
              </div>

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 font-mono text-xs text-foreground transition hover:border-primary disabled:opacity-40"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </Panel>
    </ModuleShell>
  );
}
