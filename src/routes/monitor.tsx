import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Search, Blocks, Radio, Terminal, SearchCode, AlertTriangle } from "lucide-react";
import { ModuleShell, PageHeader, Panel, RiskBadge, StatTile, short } from "@/components/ui-kit";
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

interface ModelScoreEntry {
  probability: number;
  threshold: number;
  verdict: string;
}

interface LiveTxn extends Txn {
  // Keyed by backend model_id (snake_case), e.g. "random_forest" -- present
  // when the ingest worker's payload includes registry.predict_all()'s raw
  // per-model dict alongside the consensus risk_score/verdict.
  modelScores?: Record<string, ModelScoreEntry>;
  // True when live_ingest_etherscan.py's per-wallet Etherscan token lookup
  // found no usable ERC-20 history for this sender -- the 40 erc_20_*/
  // erc_721_* features were scored as zeros for this transaction.
  featuresDefaulted?: boolean;
}

// platform-data's MODELS ids are kebab-case (UI convention); the backend's
// model_scores dict is keyed snake_case (Python convention). Same six models.
const toBackendId = (id: string) => id.replace(/-/g, "_");

function Monitor() {
  const [block, setBlock] = useState<number | null>(null);
  const [recentBlocks, setRecentBlocks] = useState<number[]>([]);
  const [txns, setTxns] = useState<LiveTxn[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<LiveTxn | null>(null);
  const [live, setLive] = useState(true);
  const [wsStatus, setWsStatus] = useState<WsStatus>("connecting");
  const [viewModel, setViewModel] = useState<string>("consensus");

  useEffect(() => {
    if (!live) return;
    setWsStatus("connecting");

    let ws: WebSocket | null = null;
    let waitTimer: number | null = null;

    const armWaitTimer = () => {
      if (waitTimer) window.clearTimeout(waitTimer);
      // ~12s block time; give the ingest worker a few blocks' grace before
      // telling the user nothing has arrived yet.
      waitTimer = window.setTimeout(() => setWsStatus((s) => (s === "connected" ? "waiting" : s)), 20000);
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
            const newTx: LiveTxn = {
              hash: payload.hash,
              from: payload.from_address || "0x0000...",
              to: payload.to_address || "0x0000...",
              value: payload.value_eth || 0,
              gas: payload.gas || 21000,
              block: payload.block_number || 0,
              risk: Number(riskVal.toFixed(1)),
              level: levelFromVerdict(payload.verdict, riskVal),
              ts: Date.now(),
              modelScores: payload.model_scores && typeof payload.model_scores === "object" ? payload.model_scores : undefined,
              featuresDefaulted: Boolean(payload.features_defaulted),
            };
            if (payload.block_number) {
              setBlock(payload.block_number);
              setRecentBlocks((prev) =>
                prev[0] === payload.block_number ? prev : [payload.block_number, ...prev].slice(0, 5),
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

  // Re-derives risk/level for the selected view -- "Consensus" reads the
  // backend's own compute_consensus() output already stored on the row; a
  // specific model reads that model's own entry from the same payload. No
  // second calculation, and falls back to consensus if this row's payload
  // didn't happen to carry that model's score.
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
        t.hash.includes(q) ||
        t.from.includes(q) ||
        t.to.includes(q) ||
        String(t.block).includes(q),
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

  return (
    <ModuleShell>
      <PageHeader
        eyebrow="Live blockchain monitoring"
        title="The chain, as it happens."
        description="Real transactions arrive from tools/live_ingest_etherscan.py, scored the moment they're ingested. Search by wallet, transaction hash or block height."
        aside={
          <button
            onClick={() => setLive((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full glass-soft px-5 py-2.5 text-sm transition hover:bg-white/8"
          >
            <Radio className={`h-4 w-4 ${status.dot}`} />
            {status.label}
          </button>
        }
      />

      {needsIngestHint ? (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-warn/30 bg-warn/8 px-5 py-4 text-xs text-warn">
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

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Scoring view
        </span>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="View risk by model">
          <button
            role="tab"
            aria-selected={viewModel === "consensus"}
            onClick={() => setViewModel("consensus")}
            className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition ${
              viewModel === "consensus" ? "bg-white/14 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/6"
            }`}
          >
            Consensus
          </button>
          {MODELS.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={viewModel === m.id}
              onClick={() => setViewModel(m.id)}
              className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition ${
                viewModel === m.id ? "bg-white/14 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/6"
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Latest block"
          value={block ? block.toLocaleString() : "—"}
          sub="~12s cadence"
          accent="cyan"
        />
        <StatTile label="Txns in window" value={String(txns.length)} sub="rolling buffer" delay={0.05} />
        <StatTile
          label="Flagged"
          value={String(flagged)}
          sub={viewModel === "consensus" ? "elevated or high risk" : `by ${MODELS.find((m) => m.id === viewModel)?.name}`}
          accent="risk"
          delay={0.1}
        />
        <StatTile
          label="Ensemble"
          value={`${MODELS.length} models`}
          sub="scoring every ingested tx"
          accent="safe"
          delay={0.15}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Panel delay={0.1} className="p-0">
          <div className="flex items-center gap-3 border-b border-white/8 px-6 py-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search wallet, tx hash or block number…"
              className="w-full bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground/70"
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {filtered.length} results
            </span>
          </div>
          <div className="max-h-[560px] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-6 py-16 text-center text-xs text-muted-foreground">
                {live ? "Waiting for the first live transaction…" : "Feed paused. Press Streaming to resume."}
              </p>
            ) : (
              <AnimatePresence initial={false}>
                {filtered.map((t) => {
                  const d = displayFor(t);
                  return (
                    <motion.button
                      key={t.hash}
                      layout
                      initial={{ opacity: 0, x: -24, backgroundColor: "rgba(120,232,255,0.10)" }}
                      animate={{ opacity: 1, x: 0, backgroundColor: "rgba(0,0,0,0)" }}
                      exit={{ opacity: 0, x: 24 }}
                      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      onClick={() => setSelected(t)}
                      className="flex w-full items-center gap-4 border-b border-white/5 px-6 py-3.5 text-left transition hover:bg-white/4"
                    >
                      <span className="w-32 shrink-0 font-mono text-[11px] text-foreground/90">
                        {short(t.hash)}
                      </span>
                      <span className="hidden w-28 shrink-0 font-mono text-[11px] text-muted-foreground sm:block">
                        {short(t.from, 4)}
                      </span>
                      <span className="hidden w-28 shrink-0 font-mono text-[11px] text-muted-foreground md:block">
                        {short(t.to, 4)}
                      </span>
                      <span className="ml-auto shrink-0 font-mono text-xs tabular-nums">
                        {t.value.toFixed(3)} Ξ
                      </span>
                      <span className="w-14 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                        {d.risk.toFixed(0)}
                      </span>
                      <RiskBadge level={d.level} label={d.level === "safe" ? "clear" : d.level} />
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel delay={0.16}>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Blocks className="h-4 w-4 text-electric" /> Latest blocks
            </h2>
            {recentBlocks.length === 0 ? (
              <p className="mt-4 text-xs text-muted-foreground">No blocks observed yet.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {recentBlocks.map((b) => (
                  <motion.li
                    key={b}
                    layout
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/3 px-4 py-3"
                  >
                    <div className="font-mono text-xs">#{b.toLocaleString()}</div>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {txns.filter((t) => t.block === b).length} txn scored
                    </span>
                  </motion.li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel delay={0.22}>
            <h2 className="text-sm font-semibold">Transaction detail</h2>
            {selected ? (
              <motion.div key={selected.hash} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                {selected.featuresDefaulted ? (
                  <div className="mt-4 flex items-center gap-2 rounded-full border border-warn/35 bg-warn/12 px-3.5 py-1.5 text-[11px] text-warn">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Scored on gas/value features — no token data found for this wallet.
                  </div>
                ) : null}
                <dl className="mt-4 space-y-3 text-xs">
                  {[
                    ["Hash", selected.hash],
                    ["From", selected.from],
                    ["To", selected.to],
                    ["Value", `${selected.value} ETH`],
                    ["Gas", `${selected.gas}`],
                    ["Block", `#${selected.block}`],
                    ["Risk score", `${displayFor(selected).risk} / 100`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-3">
                      <dt className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        {k}
                      </dt>
                      <dd className="break-all font-mono text-[11px]">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <RiskBadge level={displayFor(selected).level} />
                  <Link
                    to="/detect"
                    search={{
                      from: selected.from,
                      to: selected.to,
                      value: String(selected.value),
                      gas: String(selected.gas),
                      hash: selected.hash,
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full glass-soft px-3.5 py-1.5 text-[11px] font-medium transition hover:bg-white/10"
                  >
                    <SearchCode className="h-3.5 w-3.5" /> Investigate further
                  </Link>
                </div>
              </motion.div>
            ) : (
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                Select any transaction in the stream to inspect its full payload and AI risk score.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </ModuleShell>
  );
}
