import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useState } from "react";
import { ModuleShell, PageHeader, Panel } from "@/components/ui-kit";
import { FEATURES } from "@/lib/platform-data";

export const Route = createFileRoute("/explain")({
  head: () => ({
    meta: [
      { title: "Explainability — SHAP Reasoning · Aegis" },
      {
        name: "description",
        content:
          "Interactive SHAP waterfall, feature attributions and natural-language reasoning behind every Aegis fraud prediction.",
      },
      { property: "og:title", content: "Explainability — SHAP Reasoning · Aegis" },
      {
        property: "og:description",
        content: "Understand exactly why a transaction was flagged, feature by feature.",
      },
    ],
  }),
  component: Explain,
});

const BASE = 0.18;

function Explain() {
  const [active, setActive] = useState(FEATURES[0]!.key);
  const sorted = [...FEATURES].sort((a, b) => Math.abs(b.shap) - Math.abs(a.shap));
  const total = BASE + sorted.reduce((s, f) => s + f.shap, 0) * 0.4;
  const current = FEATURES.find((f) => f.key === active)!;

  let cursor = BASE;

  return (
    <ModuleShell>
      <PageHeader
        eyebrow="Explainability"
        title="Nothing is a black box."
        description="Every prediction decomposes into additive feature contributions. Hover the waterfall to see how each signal pushed the transaction toward or away from fraud."
      />

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Panel>
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">SHAP waterfall</h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              base {BASE.toFixed(2)} → output {total.toFixed(2)}
            </span>
          </div>
          <div className="mt-7 space-y-3">
            {sorted.map((f, i) => {
              const contribution = f.shap * 0.4;
              const start = cursor;
              cursor += contribution;
              const left = Math.min(start, cursor) * 100;
              const width = Math.abs(contribution) * 100;
              return (
                <button
                  key={f.key}
                  onMouseEnter={() => setActive(f.key)}
                  onFocus={() => setActive(f.key)}
                  className="block w-full text-left"
                >
                  <div className="flex items-baseline justify-between text-[11px]">
                    <span className={active === f.key ? "text-foreground" : "text-muted-foreground"}>
                      {f.label}
                    </span>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {contribution > 0 ? "+" : ""}
                      {contribution.toFixed(3)}
                    </span>
                  </div>
                  <div className="relative mt-2 h-4 rounded-md bg-white/5">
                    <motion.div
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: `${width}%`, opacity: 1 }}
                      transition={{ delay: i * 0.08, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-y-0 rounded-md"
                      style={{
                        left: `${left}%`,
                        background: contribution > 0 ? "var(--risk)" : "var(--safe)",
                        boxShadow:
                          active === f.key
                            ? `0 0 18px -2px ${contribution > 0 ? "var(--risk)" : "var(--safe)"}`
                            : "none",
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel delay={0.1}>
            <h2 className="text-sm font-semibold">Signal inspector</h2>
            <motion.div key={current.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="mt-5 font-display text-xl font-semibold">{current.label}</div>
              <div className="mt-2 font-mono text-xs text-cyan">observed: {current.value}</div>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                {current.shap > 0
                  ? "This signal pushed the prediction toward fraud. Values in this range appear in 6.2% of transactions but 41% of confirmed illicit flows."
                  : "This signal pulled the prediction toward legitimate. It is characteristic of long-lived, low-velocity retail wallets."}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3 text-[11px]">
                <div className="rounded-xl glass-soft p-3">
                  <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                    Global importance
                  </div>
                  <div className="mt-1 font-display text-lg tabular-nums">
                    {(current.importance * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="rounded-xl glass-soft p-3">
                  <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                    SHAP value
                  </div>
                  <div className="mt-1 font-display text-lg tabular-nums">
                    {current.shap.toFixed(2)}
                  </div>
                </div>
              </div>
            </motion.div>
          </Panel>

          <Panel delay={0.16}>
            <h2 className="text-sm font-semibold">Natural language reasoning</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              This wallet moved value through 126 unique counterparties in under an hour while
              sitting two hops from a sanctioned mixer. The in/out value ratio of 8.42 is
              inconsistent with the wallet's four-day history, and gas bidding sits 3.1σ above the
              block median — a pattern the ensemble associates with rapid exit laundering.
              Counterbalancing signals (ERC-20 diversity, contract age) were insufficient to offset
              the risk mass.
            </p>
          </Panel>
        </div>
      </div>
    </ModuleShell>
  );
}
