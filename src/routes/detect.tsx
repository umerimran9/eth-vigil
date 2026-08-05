import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Hash, Sliders, Sparkles } from "lucide-react";
import {
  Meter,
  ModuleShell,
  PageHeader,
  Panel,
  RiskBadge,
  StatTile,
} from "@/components/ui-kit";
import { FEATURES, levelFromRisk, randomHash } from "@/lib/platform-data";

export const Route = createFileRoute("/detect")({
  head: () => ({
    meta: [
      { title: "Fraud Detection — Aegis" },
      {
        name: "description",
        content:
          "Score any Ethereum transaction by hash or manual features, with confidence, risk level, SHAP attributions and an actionable recommendation.",
      },
      { property: "og:title", content: "Fraud Detection — Aegis" },
      {
        property: "og:description",
        content: "Paste a transaction hash or enter features and get an explainable fraud verdict.",
      },
    ],
  }),
  component: Detect,
});

const STAGES = [
  "Resolving transaction on chain",
  "Deriving 48 behavioural features",
  "Scoring with primary ensemble",
  "Computing SHAP attributions",
  "Composing recommendation",
];

interface Result {
  risk: number;
  confidence: number;
  ms: number;
}

function Detect() {
  const [mode, setMode] = useState<"hash" | "manual">("hash");
  const [hash, setHash] = useState("");
  const [stage, setStage] = useState(-1);
  const [result, setResult] = useState<Result | null>(null);

  const run = () => {
    setResult(null);
    setStage(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      if (i >= STAGES.length) {
        clearInterval(id);
        setStage(-1);
        const risk = Number((Math.random() * 100).toFixed(1));
        setResult({
          risk,
          confidence: Number((0.78 + Math.random() * 0.21).toFixed(3)),
          ms: Number((3 + Math.random() * 9).toFixed(1)),
        });
      } else {
        setStage(i);
      }
    }, 560);
  };

  const level = result ? levelFromRisk(result.risk) : "safe";

  return (
    <ModuleShell>
      <PageHeader
        eyebrow="Fraud detection"
        title="Interrogate any transaction."
        description="Paste a hash and Aegis retrieves the on-chain payload itself, or enter engineered features directly. Every verdict ships with its reasoning."
      />

      <div className="mb-4 inline-flex rounded-full glass-soft p-1">
        {(["hash", "manual"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="relative rounded-full px-5 py-2 text-sm capitalize"
          >
            {mode === m ? (
              <motion.span
                layoutId="detect-tab"
                className="absolute inset-0 rounded-full bg-white/10"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            ) : null}
            <span className="relative inline-flex items-center gap-2">
              {m === "hash" ? <Hash className="h-3.5 w-3.5" /> : <Sliders className="h-3.5 w-3.5" />}
              {m === "hash" ? "Transaction hash" : "Manual features"}
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel>
          {mode === "hash" ? (
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                Transaction hash
              </label>
              <input
                value={hash}
                onChange={(e) => setHash(e.target.value)}
                placeholder="0x…"
                className="mt-3 w-full rounded-2xl border border-white/10 bg-white/4 px-4 py-3.5 font-mono text-xs outline-none transition focus:border-cyan/40"
              />
              <button
                onClick={() => setHash(randomHash())}
                className="mt-3 font-mono text-[11px] text-cyan/80 hover:text-cyan"
              >
                use a sample hash
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {FEATURES.slice(0, 6).map((f) => (
                <div key={f.key}>
                  <label className="text-[11px] text-muted-foreground">{f.label}</label>
                  <input
                    defaultValue={f.value}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/4 px-3 py-2.5 font-mono text-xs outline-none transition focus:border-cyan/40"
                  />
                </div>
              ))}
            </div>
          )}

          <button
            onClick={run}
            disabled={stage >= 0}
            className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-6 py-3.5 text-sm font-medium text-background transition hover:scale-[1.01] disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {stage >= 0 ? "Analysing…" : "Run detection"}
          </button>

          <AnimatePresence>
            {stage >= 0 ? (
              <motion.ul
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 space-y-2 overflow-hidden"
              >
                {STAGES.map((s, i) => (
                  <li
                    key={s}
                    className={`flex items-center gap-3 text-xs transition-colors ${
                      i <= stage ? "text-foreground" : "text-muted-foreground/50"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        i < stage ? "bg-safe" : i === stage ? "bg-cyan animate-pulse" : "bg-white/15"
                      }`}
                    />
                    {s}
                  </li>
                ))}
              </motion.ul>
            ) : null}
          </AnimatePresence>
        </Panel>

        <div className="space-y-4">
          {result ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <StatTile
                  label="Risk score"
                  value={`${result.risk}`}
                  sub="0 = clean · 100 = certain fraud"
                  accent={level === "safe" ? "safe" : level === "high" ? "risk" : "electric"}
                />
                <StatTile
                  label="Confidence"
                  value={`${(result.confidence * 100).toFixed(1)}%`}
                  sub="calibrated probability"
                  accent="cyan"
                  delay={0.05}
                />
                <StatTile label="Processing time" value={`${result.ms} ms`} sub="end to end" delay={0.1} />
                <StatTile
                  label="Verdict"
                  value={level === "safe" ? "Legitimate" : level === "high" ? "Fraudulent" : "Suspicious"}
                  accent={level === "safe" ? "safe" : "risk"}
                  delay={0.15}
                />
              </div>

              <Panel delay={0.2}>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Recommendation</h2>
                  <RiskBadge level={level} />
                </div>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                  {level === "high"
                    ? "Block settlement and escalate to the compliance queue. The wallet shows burst activity two hops from a known mixer with an anomalous in/out value ratio."
                    : level === "elevated"
                      ? "Allow with monitoring. Counterparty contract age and transaction burst density are mildly anomalous but not conclusive."
                      : "No action required. Behavioural signature is consistent with routine retail transfer activity."}
                </p>
              </Panel>

              <Panel delay={0.26}>
                <h2 className="text-sm font-semibold">Feature attribution</h2>
                <ul className="mt-5 space-y-3.5">
                  {FEATURES.map((f) => (
                    <li key={f.key}>
                      <div className="flex items-baseline justify-between text-xs">
                        <span>{f.label}</span>
                        <span className="font-mono tabular-nums text-muted-foreground">
                          {f.shap > 0 ? "+" : ""}
                          {f.shap.toFixed(2)}
                        </span>
                      </div>
                      <div className="mt-2">
                        <Meter value={Math.abs(f.shap) * 200} tone={f.shap > 0 ? "risk" : "safe"} />
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            </>
          ) : (
            <Panel delay={0.1} className="grid min-h-[320px] place-items-center text-center">
              <div className="max-w-xs">
                <div className="mx-auto h-12 w-12 rounded-full glass-soft" />
                <p className="mt-5 text-sm text-muted-foreground">
                  Results materialise here — prediction, confidence, risk level, processing time and
                  full SHAP attribution.
                </p>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </ModuleShell>
  );
}
