import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Radio, Terminal } from "lucide-react";
import {
  EmptyState,
  ModuleShell,
  PageHeader,
  Panel,
  RiskBadge,
  SectionHeading,
  short,
} from "@/components/ui-kit";
import { InvestigationDrawer, type DrawerRecord } from "@/components/InvestigationDrawer";
import { levelFromVerdict, MODELS, type RiskLevel, type Txn } from "@/lib/platform-data";
import { WS_BASE_URL } from "@/lib/api";

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

type WsStatus = "connecting" | "connected" | "waiting" | "disconnected";
type FeedSource = "live" | "replay" | "unknown";

interface ModelScoreEntry {
  probability: number;
  threshold: number;
  verdict: string;
}

interface LiveTxn extends Txn {
  // Stable unique key for this feed entry. Not the hash: replay_dataset.py
  // truncates hashes to `hash[:18] + "..."`, so two different rows can share
  // one, and React silently drops the duplicate from the list. A counter
  // can't collide.
  feedId: string;
  modelScores?: Record<string, ModelScoreEntry>;
  featuresDefaulted?: boolean;
  verdict?: string;
  action?: string;
  // "live" = tools/live_ingest_etherscan.py (real mainnet), "replay" =
  // tools/replay_dataset.py (offline CSV replay). "unknown" if a payload
  // arrives without the field (shouldn't happen post this pass, but never
  // guessed as "live" just to look more impressive).
  source: FeedSource;
}

const toBackendId = (id: string) => id.replace(/-/g, "_");

function toDrawerRecord(t: LiveTxn, risk: number): DrawerRecord {
  return {
    hash: t.hash,
    verdict: t.verdict,
    action: t.action,
    risk,
    modelScores: t.modelScores
      ? Object.entries(t.modelScores).map(([id, m]) => ({
          model_id: id,
          name: id.toUpperCase().replace(/_/g, " "),
          probability: m.probability,
          threshold: m.threshold,
          verdict: m.verdict,
        }))
      : undefined,
    transaction: {
      hash: t.hash,
      block_number: t.block,
      timestamp: Math.floor(t.ts / 1000),
      from_address: t.from,
      to_address: t.to,
      value_eth: t.value,
      gas_used: t.gas,
      effective_gas_price_gwei: 0,
    },
  };
}

function Monitor() {
  const [block, setBlock] = useState<number | null>(null);
  const [recentBlocks, setRecentBlocks] = useState<number[]>([]);
  const [txns, setTxns] = useState<LiveTxn[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<LiveTxn | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [live, setLive] = useState(true);
  const [wsStatus, setWsStatus] = useState<WsStatus>("connecting");
  const [viewModel, setViewModel] = useState<string>("consensus");
  const [feedSource, setFeedSource] = useState<FeedSource | null>(null);
  const feedSeq = useRef(0);

  useEffect(() => {
    if (!live) return;
    setWsStatus("connecting");

    let ws: WebSocket | null = null;
    let waitTimer: number | null = null;

    const armWaitTimer = () => {
      if (waitTimer) window.clearTimeout(waitTimer);
      waitTimer = window.setTimeout(
        () => setWsStatus((s) => (s === "connected" ? "waiting" : s)),
        20000,
      );
    };

    try {
      ws = new WebSocket(`${WS_BASE_URL}/api/v1/stream/live`);

      ws.onopen = () => {
        setWsStatus("connected");
        armWaitTimer();
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload && payload.hash) {
            armWaitTimer();
            setWsStatus("connected");
            const riskVal = (payload.risk_score || 0) * 100;
            const source: FeedSource =
              payload.source === "live" || payload.source === "replay" ? payload.source : "unknown";
            setFeedSource(source);
            feedSeq.current += 1;
            const newTx: LiveTxn = {
              feedId: `${payload.hash}#${feedSeq.current}`,
              hash: payload.hash,
              from: payload.from_address || "0x0000...",
              to: payload.to_address || "0x0000...",
              value: payload.value_eth || 0,
              gas: payload.gas || 21000,
              block: payload.block_number || 0,
              risk: Number(riskVal.toFixed(1)),
              level: levelFromVerdict(payload.verdict, riskVal),
              ts: Date.now(),
              modelScores:
                payload.model_scores && typeof payload.model_scores === "object"
                  ? payload.model_scores
                  : undefined,
              featuresDefaulted: Boolean(payload.features_defaulted),
              verdict: payload.verdict,
              action: payload.action,
              source,
            };
            if (payload.block_number) {
              setBlock(payload.block_number);
              setRecentBlocks((prev) =>
                prev[0] === payload.block_number
                  ? prev
                  : [payload.block_number, ...prev].slice(0, 5),
              );
            }
            setTxns((prev) => [newTx, ...prev].slice(0, 30));
          }
        } catch {
          // ignore malformed frames
        }
      };

      ws.onerror = () => setWsStatus("disconnected");
      ws.onclose = () => setWsStatus("disconnected");
    } catch {
      setWsStatus("disconnected");
    }

    return () => {
      if (waitTimer) window.clearTimeout(waitTimer);
      if (ws) ws.close();
    };
  }, [live]);

  const displayFor = (t: LiveTxn): { risk: number; level: RiskLevel } => {
    if (viewModel === "consensus") return { risk: t.risk, level: t.level };
    const m = t.modelScores?.[toBackendId(viewModel)];
    if (!m) return { risk: t.risk, level: t.level };
    const risk = Number((m.probability * 100).toFixed(1));
    return { risk, level: levelFromVerdict(m.verdict, risk) };
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return txns;
    return txns.filter(
      (t) =>
        t.hash.includes(q) || t.from.includes(q) || t.to.includes(q) || String(t.block).includes(q),
    );
  }, [txns, query]);

  const flagged = txns.filter((t) => displayFor(t).level !== "safe").length;

  const statusMeta: Record<WsStatus, { label: string; dot: string }> = {
    connecting: { label: "Connecting…", dot: "text-muted-foreground" },
    connected: { label: "Live", dot: "text-safe" },
    waiting: { label: "Waiting for blocks…", dot: "text-warn" },
    disconnected: { label: "Disconnected", dot: "text-risk" },
  };
  const status = live ? statusMeta[wsStatus] : { label: "Paused", dot: "text-muted-foreground" };
  const needsIngestHint = live && (wsStatus === "waiting" || wsStatus === "disconnected");

  const sourceBadge =
    feedSource === "live"
      ? { label: "LIVE MAINNET", className: "border-safe/35 bg-safe/12 text-safe" }
      : feedSource === "replay"
        ? { label: "REPLAY MODE", className: "border-warn/35 bg-warn/12 text-warn" }
        : null;

  return (
    <ModuleShell>
      <PageHeader
        title="Live monitor"
        aside={
          <div className="flex items-center gap-2">
            {sourceBadge ? (
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${sourceBadge.className}`}
              >
                {sourceBadge.label}
              </span>
            ) : null}
            <button
              onClick={() => setLive((v) => !v)}
              aria-pressed={live}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition hover:bg-accent"
            >
              <Radio className={`h-4 w-4 ${status.dot}`} />
              {status.label}
            </button>
          </div>
        }
      />

      {needsIngestHint ? (
        <div className="mb-4 flex items-start gap-3 rounded-md border border-warn/30 bg-warn/8 px-5 py-4 text-xs text-warn">
          <Terminal className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">
              {wsStatus === "disconnected"
                ? "No live feed connected."
                : "Connected, but no transactions received yet."}
            </p>
            <p className="mt-1 text-warn/80">
              Start an ingest worker alongside the API server:{" "}
              <code className="font-mono">python tools/live_ingest_etherscan.py</code> for real
              mainnet, or <code className="font-mono">python tools/replay_dataset.py</code> for an
              offline replay (requires <code className="font-mono">ETHERSCAN_API_KEY</code> in{" "}
              <code className="font-mono">.env</code> for the live variant).
            </p>
          </div>
        </div>
      ) : null}

      {/* Feed statistics as one line of text, not four KPI tiles. Three of
          the four were a block height, a buffer length and a constant
          ("Ensemble — 6 models"), which is status, not measurement. */}
      <p className="mb-3 text-xs text-muted-foreground">
        {block ? `Block #${block.toLocaleString()}` : "No block observed yet"} ·{" "}
        <span className="tabular-nums">{txns.length}</span> in buffer ·{" "}
        <span className="tabular-nums">{flagged}</span> flagged
        {viewModel === "consensus" ? "" : ` by ${MODELS.find((m) => m.id === viewModel)?.name}`}
      </p>

      <div className="grid gap-4 lg:grid-cols-[1.8fr_1fr]">
        <Panel className="p-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-2.5">
            <div className="flex min-w-44 flex-1 items-center gap-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search wallet, hash or block…"
                aria-label="Search the feed"
                className="w-full bg-transparent font-mono text-xs placeholder:text-muted-foreground"
              />
            </div>
            {/* Seven uppercase pills became a select. A segmented control
                implies a handful of peer options; this is a single choice
                from a list that grows with the ensemble. */}
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Score by
              <select
                value={viewModel}
                onChange={(e) => setViewModel(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
              >
                <option value="consensus">Consensus</option>
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-xs tabular-nums text-muted-foreground">
              {filtered.length} shown
            </span>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {filtered.length === 0 ? (
              <EmptyState
                title={live ? "Waiting for the first transaction" : "Feed paused"}
                body={
                  live
                    ? "Transactions appear here as the ingest worker scores them."
                    : "Press the status button above to resume streaming."
                }
              />
            ) : (
              filtered.map((t) => {
                const d = displayFor(t);
                const stripe =
                  d.level === "high" ? "bg-risk" : d.level === "elevated" ? "bg-warn" : "bg-safe";
                return (
                  <button
                    key={t.feedId}
                    onClick={() => {
                      setSelected(t);
                      setDrawerOpen(true);
                    }}
                    className="relative flex w-full items-center gap-4 border-b border-border py-2.5 pl-4 pr-4 text-left transition last:border-b-0 hover:bg-accent/50"
                  >
                    <span className={`absolute inset-y-0 left-0 w-[3px] ${stripe}`} />
                    <span className="w-28 shrink-0 font-mono text-[11px]">{short(t.hash)}</span>
                    <span className="hidden w-24 shrink-0 font-mono text-[11px] text-muted-foreground sm:block">
                      {short(t.from, 4)}
                    </span>
                    <span className="hidden w-24 shrink-0 font-mono text-[11px] text-muted-foreground md:block">
                      {short(t.to, 4)}
                    </span>
                    <span className="ml-auto shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                      {t.value.toFixed(3)} Ξ
                    </span>
                    <span className="w-10 shrink-0 text-right font-mono text-sm font-medium tabular-nums">
                      {d.risk.toFixed(0)}
                    </span>
                    <RiskBadge level={d.level} label={d.level === "safe" ? "Clear" : undefined} />
                  </button>
                );
              })
            )}
          </div>
        </Panel>

        <div>
          <Panel className="p-0">
            <div className="px-4 py-3">
              <SectionHeading title="Latest blocks" />
            </div>
            {recentBlocks.length === 0 ? (
              <p className="px-4 pb-4 text-xs text-muted-foreground">No blocks observed yet.</p>
            ) : (
              <ul className="border-t border-border">
                {recentBlocks.map((b) => (
                  <li
                    key={b}
                    className="flex items-center justify-between border-b border-border px-4 py-2 last:border-b-0"
                  >
                    <span className="font-mono text-xs">#{b.toLocaleString()}</span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {txns.filter((t) => t.block === b).length} scored
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Select any transaction to open its full investigation.
          </p>
        </div>
      </div>

      <InvestigationDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        record={selected ? toDrawerRecord(selected, displayFor(selected).risk) : null}
      />
    </ModuleShell>
  );
}
