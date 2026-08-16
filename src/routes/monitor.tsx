import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Search, Blocks, Fuel, Radio } from "lucide-react";
import { ModuleShell, PageHeader, Panel, RiskBadge, StatTile, short } from "@/components/ui-kit";
import { makeTxn, type Txn } from "@/lib/platform-data";

export const Route = createFileRoute("/monitor")({
  head: () => ({
    meta: [
      { title: "Live Ethereum Monitoring — Aegis" },
      {
        name: "description",
        content:
          "Stream Ethereum blocks and transactions in real time with AI risk indicators, wallet search and instant transaction inspection.",
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

function Monitor() {
  const [block, setBlock] = useState(21_452_118);
  const [txns, setTxns] = useState<Txn[]>(() =>
    Array.from({ length: 12 }, () => makeTxn(21_452_118)),
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Txn | null>(null);
  const [live, setLive] = useState(true);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      setBlock((b) => {
        const next = Math.random() < 0.35 ? b + 1 : b;
        setTxns((prev) => [makeTxn(next), ...prev].slice(0, 26));
        return next;
      });
    }, 1600);
    return () => clearInterval(id);
  }, [live]);

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

  const flagged = txns.filter((t) => t.level !== "safe").length;

  return (
    <ModuleShell>
      <PageHeader
        eyebrow="Live blockchain monitoring"
        title="The chain, as it happens."
        description="Blocks and transfers arrive from the Ethereum mainnet feed and are scored the moment they land. Search by wallet, transaction hash or block height."
        aside={
          <button
            onClick={() => setLive((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full glass-soft px-5 py-2.5 text-sm transition hover:bg-white/8"
          >
            <Radio className={`h-4 w-4 ${live ? "text-safe" : "text-muted-foreground"}`} />
            {live ? "Streaming" : "Paused"}
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Latest block" value={block.toLocaleString()} sub="~12s cadence" accent="cyan" />
        <StatTile label="Txns in window" value={String(txns.length)} sub="rolling buffer" delay={0.05} />
        <StatTile
          label="Flagged"
          value={String(flagged)}
          sub="elevated or high risk"
          accent="risk"
          delay={0.1}
        />
        <StatTile label="Median score time" value="4.1 ms" sub="LightGBM primary" accent="safe" delay={0.15} />
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
            <AnimatePresence initial={false}>
              {filtered.map((t) => (
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
                    {t.risk.toFixed(0)}
                  </span>
                  <RiskBadge level={t.level} label={t.level === "safe" ? "clear" : t.level} />
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel delay={0.16}>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Blocks className="h-4 w-4 text-electric" /> Latest blocks
            </h2>
            <ul className="mt-4 space-y-2">
              {Array.from({ length: 5 }, (_, i) => block - i).map((b, i) => (
                <motion.li
                  key={b}
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/3 px-4 py-3"
                >
                  <div>
                    <div className="font-mono text-xs">#{b.toLocaleString()}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {120 + ((b % 7) * 13)} txns · {i * 12 + 4}s ago
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                    <Fuel className="h-3 w-3" /> {(12 + (b % 9) * 1.7).toFixed(1)} gwei
                  </span>
                </motion.li>
              ))}
            </ul>
          </Panel>

          <Panel delay={0.22}>
            <h2 className="text-sm font-semibold">Transaction detail</h2>
            {selected ? (
              <motion.dl
                key={selected.hash}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 space-y-3 text-xs"
              >
                {[
                  ["Hash", selected.hash],
                  ["From", selected.from],
                  ["To", selected.to],
                  ["Value", `${selected.value} ETH`],
                  ["Gas", `${selected.gas} gwei`],
                  ["Block", `#${selected.block}`],
                  ["Risk score", `${selected.risk} / 100`],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-3">
                    <dt className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {k}
                    </dt>
                    <dd className="break-all font-mono text-[11px]">{v}</dd>
                  </div>
                ))}
                <RiskBadge level={selected.level} />
              </motion.dl>
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
