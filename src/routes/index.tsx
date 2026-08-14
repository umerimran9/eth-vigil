import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Box,
  Brain,
  Download,
  FileCheck,
  FolderSearch,
  HelpCircle,
  Layers,
  Radar,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from "lucide-react";
import {
  EmptyState,
  ModuleShell,
  Panel,
  RiskBadge,
  SectionHeading,
  SkeletonRows,
  short,
} from "@/components/ui-kit";
import { BlockchainHero3D } from "@/components/BlockchainHero3D";
import {
  MODELS,
  SAMPLE_PRESETS,
  levelFromVerdict,
  verdictLabel,
  type RiskLevel,
} from "@/lib/platform-data";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aegis — Ethereum Blockchain Security & AI Intelligence" },
      {
        name: "description",
        content:
          "AI-powered Ethereum blockchain monitoring and fraud detection command center. Score transactions across 7 machine learning models with real-time consensus and XAI attributions.",
      },
      { property: "og:title", content: "Aegis — Ethereum Fraud Intelligence Command Center" },
      {
        property: "og:description",
        content: "Real-time Ethereum fraud detection across 7 production AI models with XAI explainability.",
      },
    ],
  }),
  component: Home,
});

interface Row {
  id: string;
  hash: string;
  risk: number;
  verdict: string;
  level: RiskLevel;
  at: string;
}

function Home() {
  const navigate = useNavigate();
  const [hash, setHash] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showFypGuide, setShowFypGuide] = useState(false);

  useEffect(() => {
    apiFetch<any>("/api/v1/history")
      .then(({ ok, data }) => {
        if (ok && Array.isArray(data?.history)) {
          setRows(
            data.history.map((h: any) => ({
              id: h.id,
              hash: h.hash,
              risk: h.risk,
              verdict: h.verdict ?? "",
              level: levelFromVerdict(h.verdict, h.risk),
              at: h.at,
            })),
          );
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  const summary = useMemo(() => {
    const total = rows.length;
    const high = rows.filter((r) => r.level === "high").length;
    const elevated = rows.filter((r) => r.level === "elevated").length;
    const avg = total ? rows.reduce((s, r) => s + r.risk, 0) / total : 0;
    return { total, high, elevated, avg };
  }, [rows]);

  const recent = rows.slice(0, 6);

  const analyse = () => {
    if (!hash.trim()) return;
    navigate({ to: "/detect", search: { hash: hash.trim(), aegisRun: true } });
  };

  const loadPreset = (preset: (typeof SAMPLE_PRESETS)[number]) => {
    navigate({
      to: "/detect",
      search: {
        hash: preset.hash,
        from: preset.from,
        to: preset.to,
        value: preset.value,
        aegisRun: true,
      },
    });
  };

  return (
    <ModuleShell>
      <div className="space-y-5">
        {/* Section 1: Live Network Telemetry Surface */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-border bg-card p-3">
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-safe animate-pulse" />
              <span className="font-bold text-foreground">ETHEREUM MAINNET</span>
            </div>
            <span className="text-border">|</span>
            <div className="text-muted-foreground">
              Block: <span className="font-semibold text-foreground">#19,485,021</span>
            </div>
            <span className="text-border">|</span>
            <div className="text-muted-foreground">
              Base Fee: <span className="font-semibold text-foreground">28 Gwei</span>
            </div>
            <span className="text-border">|</span>
            <div className="text-muted-foreground">
              ML Serving: <span className="font-semibold text-safe">7/7 Models Online</span> (1.8ms P50)
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFypGuide(!showFypGuide)}
              className="inline-flex items-center gap-1.5 rounded border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-muted"
            >
              <HelpCircle className="h-3.5 w-3.5 text-primary" />
              <span>{showFypGuide ? "Hide Feature Spec" : "33/61 Feature Architecture"}</span>
            </button>
          </div>
        </div>

        {/* Section 2: Interactive 3D Blockchain Consensus & Entity Topology */}
        <BlockchainHero3D />

        {/* FYP Educational Feature Vector Architecture Breakdown (Collapsible) */}
        {showFypGuide ? (
          <div className="rounded border border-primary/20 bg-primary/5 p-4 text-xs leading-relaxed text-foreground">
            <div className="flex items-center gap-2 text-xs font-bold text-primary font-mono uppercase tracking-wider">
              <Brain className="h-3.5 w-3.5" />
              <span>FYP On-Chain Feature Engineering Pipeline (61 Dimensions)</span>
            </div>
            <p className="mt-1.5 text-muted-foreground">
              Raw RPC transaction payloads (hash, sender, receiver, gas, value) are transformed into a <strong>61-dimensional feature vector</strong> consisting of 33 core wallet behavioral statistics, temporal era-relative z-scores, and token lexical heuristics.
            </p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-3 text-xs">
              <div className="rounded border border-border bg-card p-2.5">
                <span className="font-semibold text-foreground">1. Wallet Historical Metrics</span>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Evaluates historical ERC-20 transfer velocities, unique contract creation counts, and token symbol heuristics.
                </p>
              </div>
              <div className="rounded border border-border bg-card p-2.5">
                <span className="font-semibold text-foreground">2. Era-Relative Z-Scores</span>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Normalizes gas price and efficiency against block epoch baselines to isolate flash-loan exploits and MEV spikes.
                </p>
              </div>
              <div className="rounded border border-border bg-card p-2.5">
                <span className="font-semibold text-foreground">3. 7-Model Ensemble Consensus</span>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Aggregates predictions from LightGBM, XGBoost, RF, TabNet, FT-Transformer, MLP, and LogReg with natural-language SHAP explainability.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Section 3: Instant On-Chain Transaction Scorer */}
        <Panel className="border-border bg-card p-4">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <label htmlFor="hero-hash" className="text-xs font-bold uppercase tracking-wider text-foreground">
                On-Chain Transaction Intelligence
              </label>
              <span className="font-mono text-[10px] text-muted-foreground">7 Models + SHAP Explainability</span>
            </div>
            <span className="text-xs text-muted-foreground">
              Enter any Ethereum transaction hash to evaluate multi-model consensus risk and inspect natural-language SHAP feature contributions.
            </span>
          </div>

          <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
            <input
              id="hero-hash"
              value={hash}
              onChange={(e) => setHash(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") analyse();
              }}
              placeholder="0x8a3f9e2b1c4d5a6e7f8a9b0c… or Paste Ethereum Hash"
              className="min-w-0 flex-1 rounded border border-border bg-secondary px-3 py-2 font-mono text-xs text-foreground shadow-xs transition focus:border-primary focus:outline-none"
            />
            <button
              onClick={analyse}
              className="inline-flex items-center justify-center gap-1.5 rounded bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:opacity-90"
            >
              <Radar className="h-3.5 w-3.5" />
              <span>Score Transaction</span>
            </button>
          </div>

          {/* Attack Presets & Benchmarks */}
          <div className="mt-5 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Attack Presets & Real Benchmarks
              </span>
              <span className="text-[11px] text-muted-foreground">Click to run instant scan</span>
            </div>

            <div className="mt-2.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {SAMPLE_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => loadPreset(preset)}
                  className="flex flex-col rounded-xl border border-border bg-background/60 p-3 text-left transition hover:border-primary/50 hover:bg-accent/40"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-foreground">{preset.name}</span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[9px] font-bold",
                        preset.type === "High Risk"
                          ? "bg-risk/10 text-risk border border-risk/20"
                          : "bg-safe/10 text-safe border border-safe/20",
                      )}
                    >
                      {preset.type}
                    </span>
                  </div>
                  <span className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {preset.value} ETH · {preset.gasUsed} gas
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Panel>

        {/* 7 Models Card Deck */}
        <div>
          <div className="flex items-center justify-between pb-3">
            <div>
              <h2 className="text-base font-bold tracking-tight">Active 7-Model Intelligence Suite</h2>
              <p className="text-xs text-muted-foreground">
                Ensemble of gradient boosted trees, attentive neural networks, and self-attention transformers.
              </p>
            </div>
            <Link
              to="/models"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              View Full Metrics <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {MODELS.map((m) => (
              <Link
                key={m.id}
                to="/models/$modelId"
                params={{ modelId: m.id }}
                className="group flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/50 hover:bg-accent/30"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {m.family}
                    </span>
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
                      {m.latencyMs}ms
                    </span>
                  </div>
                  <h3 className="mt-1 text-sm font-bold text-foreground transition group-hover:text-primary">
                    {m.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {m.tagline}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-[11px]">
                  <span className="text-muted-foreground">ROC-AUC: <span className="font-semibold text-foreground">{m.rocAuc.toFixed(3)}</span></span>
                  <span className="text-muted-foreground">F1: <span className="font-semibold text-foreground">{(m.f1 * 100).toFixed(1)}%</span></span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Feature Hub Navigation Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Link
            to="/monitor"
            className="group rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-safe/50 hover:bg-safe/5"
          >
            <div className="flex items-center justify-between">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-safe/10 text-safe">
                <Activity className="h-5 w-5 animate-pulse" />
              </div>
              <span className="rounded-full border border-safe/30 bg-safe/10 px-2 py-0.5 text-[10px] font-bold text-safe">
                Live Feed
              </span>
            </div>
            <h3 className="mt-3 text-sm font-bold">Live Blockchain Stream</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Stream newly mined Ethereum blocks and transactions scored live as they enter the mempool.
            </p>
          </Link>

          <Link
            to="/batch"
            className="group rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/50 hover:bg-primary/5"
          >
            <div className="flex items-center justify-between">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <Layers className="h-5 w-5" />
              </div>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                CSV Pipeline
              </span>
            </div>
            <h3 className="mt-3 text-sm font-bold">Batch Transaction Scanner</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Upload historical CSV dumps to batch-score thousands of transactions with statistical distribution graphs.
            </p>
          </Link>

          <Link
            to="/reports"
            className="group rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-warn/50 hover:bg-warn/5"
          >
            <div className="flex items-center justify-between">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-warn/10 text-warn">
                <Download className="h-5 w-5" />
              </div>
              <span className="rounded-full border border-warn/30 bg-warn/10 px-2 py-0.5 text-[10px] font-bold text-warn">
                Cryptographic Audit
              </span>
            </div>
            <h3 className="mt-3 text-sm font-bold">Forensic Audit Reports</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Generate executive cryptographic incident reports with compliance checklists and evidence waterfalls.
            </p>
          </Link>
        </div>

        {/* Recent Cases Section */}
        <div>
          <div className="flex items-center justify-between pb-3">
            <div>
              <h2 className="text-base font-bold tracking-tight">Recent Investigations</h2>
              <p className="text-xs text-muted-foreground">
                Audit history of scored transactions and consensus evaluations.
              </p>
            </div>
            <Link
              to="/cases"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              View All Cases <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <Panel className="border-border bg-card p-0">
            {loaded && recent.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="No investigations yet"
                  description="Score a transaction above or load a sample attack preset to start your session."
                  action={
                    <button
                      onClick={() => loadPreset(SAMPLE_PRESETS[0])}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                    >
                      Run Flash Loan Sample
                    </button>
                  }
                />
              </div>
            ) : !loaded ? (
              <div className="p-4">
                <SkeletonRows count={4} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Case ID</th>
                      <th className="px-4 py-2.5 font-medium">Transaction Hash</th>
                      <th className="px-4 py-2.5 font-medium">Risk Score</th>
                      <th className="px-4 py-2.5 font-medium">Verdict</th>
                      <th className="px-4 py-2.5 text-right font-medium">Timestamp</th>
                      <th className="w-16 px-4 py-2.5 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((r) => (
                      <tr key={r.id} className="border-b border-border last:border-b-0 hover:bg-accent/40">
                        <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">
                          {r.id}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {short(r.hash, 12)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold tabular-nums">{r.risk.toFixed(1)}%</span>
                            <RiskBadge level={r.level} />
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {verdictLabel(r.verdict)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                          {r.at.replace("T", " ").replace("Z", "")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => navigate({ to: "/detect", search: { hash: r.hash, aegisRun: true } })}
                            className="rounded px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </ModuleShell>
  );
}
