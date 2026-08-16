import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Copy,
  Cpu,
  ExternalLink,
  Flame,
  Hash,
  Layers,
  Network,
  PlayCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Wallet,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Meter, ModuleShell, PageHeader, Panel, RiskBadge, short, StatTile } from "@/components/ui-kit";
import { actionLabel, levelFromVerdict, MODELS, verdictLabel } from "@/lib/platform-data";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface DetectSearch {
  from?: string | undefined;
  to?: string | undefined;
  value?: string | undefined;
  gas?: string | undefined;
  hash?: string | undefined;
}

export const Route = createFileRoute("/detect")({
  validateSearch: (search: Record<string, unknown>): DetectSearch => ({
    from: typeof search["from"] === "string" ? search["from"] : undefined,
    to: typeof search["to"] === "string" ? search["to"] : undefined,
    value:
      typeof search["value"] === "string"
        ? search["value"]
        : typeof search["value"] === "number"
        ? String(search["value"])
        : undefined,
    gas:
      typeof search["gas"] === "string"
        ? search["gas"]
        : typeof search["gas"] === "number"
        ? String(search["gas"])
        : undefined,
    hash: typeof search["hash"] === "string" ? search["hash"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Fraud Detection — Aegis" },
      {
        name: "description",
        content:
          "Score any Ethereum transaction with live Etherscan token enrichment, multi-model consensus, real SHAP feature attribution, and forensic verdicts.",
      },
      { property: "og:title", content: "Fraud Detection — Aegis" },
      {
        property: "og:description",
        content: "Configure transaction parameters and get an explainable, multi-model fraud verdict.",
      },
    ],
  }),
  component: Detect,
});

const STAGES = [
  "Looking up wallet token data",
  "Deriving 61-feature vector",
  "Scoring across the ensemble",
  "Computing model consensus",
  "Generating explainability report",
];

interface ModelScore {
  model_id: string;
  name: string;
  probability: number;
  threshold: number;
  verdict: string;
}

interface TransactionMeta {
  hash: string;
  block_number: number;
  timestamp: number;
  from_address: string;
  to_address: string | null;
  value_eth: number;
  gas_used: number;
  effective_gas_price_gwei: number;
}

interface Result {
  verdict: string;
  action: string;
  risk: number;
  confidence: number;
  agreedModels: number;
  totalModels: number;
  ms: number;
  recommendations: string[];
  shapWaterfall: Array<{ feature: string; shap_value: number; value: number }>;
  shapReal: boolean;
  shapModels: string[];
  featuresDefaulted: boolean;
  modelScores: ModelScore[];
  transaction: TransactionMeta | null;
}

const PRESETS = [
  {
    name: "Vitalik (1inch Swap)",
    icon: Wallet,
    fromAddr: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
    toAddr: "0x1111111254fb6c44bac0bed2854e76f90643097d",
    valueEth: "1.45",
    gasUsed: "21000",
  },
  {
    name: "Peer Transfer",
    icon: ArrowRightLeft,
    fromAddr: "0x28c6c06298d514db089934071355e5743bf21d60",
    toAddr: "0x7a250d5630b4cf539739df2c5dacb4c659f2488d",
    valueEth: "0.50",
    gasUsed: "21000",
  },
  {
    name: "DeFi Contract Call",
    icon: Cpu,
    fromAddr: "0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be",
    toAddr: "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45",
    valueEth: "3.20",
    gasUsed: "145000",
  },
  {
    name: "High-Gas Drain Anomaly",
    icon: Flame,
    fromAddr: "0x8894e0a0c962cb723c1976a4421c95949be2d4e3",
    toAddr: "0x000000000000000000000000000000000000dead",
    valueEth: "15.00",
    gasUsed: "820000",
  },
];

const copy = (text: string, label: string) => {
  navigator.clipboard?.writeText(text).then(() => toast.success(`${label} copied`));
};

function formatFeatureName(name: string): { title: string; subtitle: string } {
  const map: Record<string, { title: string; subtitle: string }> = {
    erc_20_Name_Lowercase_Count: {
      title: "ERC-20 Token Name Lowercase Count",
      subtitle: "Token metadata casing distribution",
    },
    erc_20_TokenQuantity: {
      title: "ERC-20 Token Holding Quantity",
      subtitle: "Sender wallet balance volume",
    },
    erc_721_Name_Uppercase_Ratio: {
      title: "ERC-721 NFT Name Uppercase Ratio",
      subtitle: "NFT symbol and contract formatting",
    },
    erc_20_Quantity_Is_Int: {
      title: "ERC-20 Integer Balance Alignment",
      subtitle: "Whole number token precision flag",
    },
    erc_20_Name_Is_Alnum: {
      title: "ERC-20 Alphanumeric Name Check",
      subtitle: "Absence of suspicious unicode/symbols",
    },
    erc_721_Symbol_Is_Uppercase: {
      title: "ERC-721 Standard Uppercase Symbol",
      subtitle: "Compliance with ERC-721 token registry",
    },
    erc_20_Log_Quantity: {
      title: "ERC-20 Log-Scaled Token Balance",
      subtitle: "Normalized wallet holding magnitude",
    },
    erc_721_TokenQuantity: {
      title: "ERC-721 NFT Portfolio Count",
      subtitle: "Total NFT assets held by sender",
    },
    value: {
      title: "Transaction Transfer Value",
      subtitle: "Ether transferred in wei",
    },
    gas_used: {
      title: "Execution Gas Consumption",
      subtitle: "Computation overhead of call",
    },
    effective_gas_price: {
      title: "Effective Gas Price (Base + Tip)",
      subtitle: "Priority fee paid for block inclusion",
    },
  };

  if (map[name]) return map[name];
  const formatted = name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { title: formatted, subtitle: name };
}

function Detect() {
  const search = Route.useSearch();

  const [fromAddr, setFromAddr] = useState(search.from ?? PRESETS[0].fromAddr);
  const [toAddr, setToAddr] = useState(search.to ?? PRESETS[0].toAddr);
  const [valueEth, setValueEth] = useState(search.value !== undefined ? search.value : PRESETS[0].valueEth);
  const [gasUsed, setGasUsed] = useState(search.gas !== undefined ? search.gas : PRESETS[0].gasUsed);
  const [hash, setHash] = useState(search.hash ?? "");

  useEffect(() => {
    if (search.from !== undefined) setFromAddr(search.from);
    if (search.to !== undefined) setToAddr(search.to);
    if (search.value !== undefined) setValueEth(search.value);
    if (search.gas !== undefined) setGasUsed(search.gas);
    if (search.hash !== undefined) setHash(search.hash);
  }, [search.from, search.to, search.value, search.gas, search.hash]);

  const [selectedModel, setSelectedModel] = useState<string>("consensus");
  const [stage, setStage] = useState(-1);
  const [result, setResult] = useState<Result | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [viewModel, setViewModel] = useState<string>("consensus");
  const [scoredBy, setScoredBy] = useState<string>("consensus");

  const buildPayload = (o?: Partial<{ fromAddr: string; toAddr: string; valueEth: string; gasUsed: string; hash: string }>) => {
    const v = o?.valueEth ?? valueEth;
    const g = o?.gasUsed ?? gasUsed;
    const valWei = Math.round(parseFloat(v || "0") * 1e18);
    const gUsed = parseInt(g || "21000", 10);
    return {
      hash: o?.hash ?? (hash.trim() || "0x" + "0".repeat(64)),
      from_address: o?.fromAddr ?? fromAddr ?? "0x0000000000000000000000000000000000000000",
      to_address: o?.toAddr ?? toAddr ?? "0x0000000000000000000000000000000000000000",
      value: valWei,
      gas: gUsed,
      gas_used: gUsed,
      effective_gas_price: 24500000000,
      cumulative_gas_used: 1200000,
      nonce: 42,
    };
  };

  const selectModel = async (id: string) => {
    setViewModel(id);
    setSelectedModel(id);
    if (!result) return;
    const base = buildPayload();
    await run({ ...base, model_id: id === "consensus" ? null : id.replace(/-/g, "_") }, id);
  };

  const run = async (payload?: Record<string, unknown>, asModel = selectedModel) => {
    setResult(null);
    setErrorMsg(null);

    if (!payload) {
      if (!fromAddr.trim()) {
        setErrorMsg("From address is required for transaction analysis.");
        return;
      }
      payload = {
        ...buildPayload(),
        model_id: asModel === "consensus" ? null : asModel.replace(/-/g, "_"),
      };
    } else if (!("model_id" in payload)) {
      payload = {
        ...payload,
        model_id: asModel === "consensus" ? null : asModel.replace(/-/g, "_"),
      };
    }
    setStage(0);
    const startTime = performance.now();

    const timers: number[] = [];
    for (let i = 1; i < STAGES.length; i++) {
      timers.push(window.setTimeout(() => setStage(i), i * 480));
    }

    const { ok, data, error } = await apiFetch<any>("/api/v1/transactions/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    timers.forEach((t) => window.clearTimeout(t));
    const endTime = performance.now();

    if (ok && data?.data?.assessment) {
      setStage(STAGES.length);
      await new Promise((r) => setTimeout(r, 300));
      const d = data.data;
      const a = d.assessment;
      setScoredBy(asModel);
      setViewModel(asModel);
      setResult({
        verdict: a.verdict,
        action: a.action,
        risk: Number((a.overall_risk_score * 100).toFixed(1)),
        confidence: Number((a.agreement_percentage / 100).toFixed(3)),
        agreedModels: a.agreed_models,
        totalModels: a.total_models,
        ms: Number((endTime - startTime).toFixed(1)),
        recommendations: d.recommendations || [],
        shapWaterfall: d.explainability?.shap?.available
          ? d.explainability.shap.features.map((f: any) => ({
              feature: f.feature,
              shap_value: f.shap_value,
              value: f.value,
            }))
          : (d.explainability?.feature_signals ?? []).map((f: any) => ({
              feature: f.label || f.feature,
              shap_value: f.signal_value,
              value: f.value,
            })),
        shapReal: Boolean(d.explainability?.shap?.available),
        shapModels: d.explainability?.shap?.models ?? [],
        featuresDefaulted: Boolean(d.features_defaulted),
        modelScores: d.model_scores || [],
        transaction: d.transaction || null,
      });
    } else {
      setErrorMsg(error || "The backend returned an unexpected response shape.");
    }
    setStage(-1);
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setHash("");
    setFromAddr(preset.fromAddr);
    setToAddr(preset.toAddr);
    setValueEth(preset.valueEth);
    setGasUsed(preset.gasUsed);
    toast.info(`Loaded preset: ${preset.name}`);
  };

  const busy = stage >= 0;

  return (
    <ModuleShell>
      <PageHeader
        eyebrow="Fraud detection"
        title="Interrogate any transaction."
        description="Configure on-chain transaction parameters to evaluate live Etherscan token enrichment, multi-model consensus, real SHAP feature attributions, and forensic verdicts."
      />

      {/* Quick-Fill Scenario Presets Bar */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mr-1">
          Quick Presets:
        </span>
        {PRESETS.map((preset) => {
          const Icon = preset.icon;
          const isCurrent =
            fromAddr === preset.fromAddr &&
            toAddr === preset.toAddr &&
            valueEth === preset.valueEth &&
            gasUsed === preset.gasUsed;

          return (
            <button
              key={preset.name}
              type="button"
              onClick={() => applyPreset(preset)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11px] transition",
                isCurrent
                  ? "border-cyan/40 bg-cyan/15 text-cyan shadow-[0_0_12px_rgba(6,182,212,0.18)]"
                  : "border-white/8 bg-white/3 text-muted-foreground hover:border-white/20 hover:bg-white/6 hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-cyan-accent" />
              <span>{preset.name}</span>
            </button>
          );
        })}
      </div>

      {/* Top Section: Dual Balanced Columns with matching height */}
      <div className="grid items-stretch gap-5 lg:grid-cols-2">
        {/* Left: Input Panel */}
        <Panel className="relative flex h-full flex-col justify-between p-6 sm:p-7">
          <div>
            <div className="flex items-center justify-between border-b border-white/6 pb-4">
              <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                <Sliders className="h-3.5 w-3.5 text-cyan" />
                Transaction Parameters
              </span>
              <span className="rounded-full bg-cyan/10 px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-cyan">
                Live Token Enrichment
              </span>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">From Address (Sender)</label>
                <input
                  value={fromAddr}
                  onChange={(e) => setFromAddr(e.target.value)}
                  placeholder="0x…"
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/4 px-3 py-2.5 font-mono text-xs outline-none transition focus:border-cyan/50 focus:bg-white/6"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">To Address / Contract</label>
                <input
                  value={toAddr}
                  onChange={(e) => setToAddr(e.target.value)}
                  placeholder="0x…"
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/4 px-3 py-2.5 font-mono text-xs outline-none transition focus:border-cyan/50 focus:bg-white/6"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Transfer Value (ETH)</label>
                <input
                  value={valueEth}
                  onChange={(e) => setValueEth(e.target.value)}
                  placeholder="1.45"
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/4 px-3 py-2.5 font-mono text-xs outline-none transition focus:border-cyan/50 focus:bg-white/6"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Gas Used</label>
                <input
                  value={gasUsed}
                  onChange={(e) => setGasUsed(e.target.value)}
                  placeholder="21000"
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/4 px-3 py-2.5 font-mono text-xs outline-none transition focus:border-cyan/50 focus:bg-white/6"
                />
              </div>
            </div>

            {/* Target Model Selector */}
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                  <Cpu className="h-3.5 w-3.5 text-cyan" />
                  Target AI Model / Strategy
                </label>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {selectedModel === "consensus"
                    ? "6-Model Ensemble"
                    : MODELS.find((m) => m.id === selectedModel)?.name || "Single Model"}
                </span>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedModel("consensus");
                    setViewModel("consensus");
                  }}
                  className={cn(
                    "relative flex flex-col items-start rounded-xl p-2.5 text-left transition border",
                    selectedModel === "consensus"
                      ? "border-cyan/50 bg-cyan/12 text-foreground shadow-[0_0_14px_rgba(6,182,212,0.18)]"
                      : "border-white/5 bg-white/3 text-muted-foreground hover:border-white/15 hover:bg-white/6 hover:text-foreground",
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Consensus</span>
                    {selectedModel === "consensus" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan animate-pulse shrink-0" />
                    )}
                  </div>
                  <span className="mt-0.5 text-[10px] text-muted-foreground leading-tight">
                    Ensemble
                  </span>
                </button>

                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSelectedModel(m.id);
                      setViewModel(m.id);
                    }}
                    className={cn(
                      "relative flex flex-col items-start rounded-xl p-2.5 text-left transition border",
                      selectedModel === m.id
                        ? "border-cyan/50 bg-cyan/12 text-foreground shadow-[0_0_14px_rgba(6,182,212,0.18)]"
                        : "border-white/5 bg-white/3 text-muted-foreground hover:border-white/15 hover:bg-white/6 hover:text-foreground",
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-xs font-semibold text-foreground truncate pr-1">
                        {m.name}
                      </span>
                      {selectedModel === m.id && (
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan animate-pulse shrink-0" />
                      )}
                    </div>
                    <span className="mt-0.5 text-[10px] text-muted-foreground leading-tight truncate w-full">
                      {m.family}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="mt-6 flex gap-2.5">
              <button
                onClick={() => run()}
                disabled={busy}
                className="grad-fill sheen inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-medium transition disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {busy ? "Analysing Transaction…" : "Run detection"}
              </button>
              <button
                onClick={() => applyPreset(PRESETS[0])}
                disabled={busy}
                title="Reset to sample transaction"
                className="inline-flex items-center justify-center gap-2 rounded-2xl glass-soft px-5 py-3.5 text-sm font-medium transition hover:bg-white/8 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" /> Reset
              </button>
            </div>

            <AnimatePresence>
              {busy ? (
                <motion.ul
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-5 space-y-1.5 overflow-hidden rounded-2xl border border-white/5 bg-white/2 p-3"
                >
                  {STAGES.map((s, i) => (
                    <li
                      key={s}
                      className={`flex items-center gap-2.5 text-xs transition-colors ${
                        i < stage ? "text-foreground" : "text-muted-foreground/50"
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
          </div>
        </Panel>

        {/* Right: Executive Verdict / Status Panel */}
        <div className="h-full">
          {result ? (
            <div className="flex h-full flex-col">
              {result.featuresDefaulted ? (
                <div className="mb-3 flex items-center gap-2 rounded-2xl border border-warn/35 bg-warn/12 px-4 py-2 text-xs text-warn">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Scored on gas/value features — token data defaulted safely.
                </div>
              ) : null}
              <VerdictHero result={result} viewModel={viewModel} onSelectModel={selectModel} />
            </div>
          ) : errorMsg ? (
            <Panel delay={0.1} className="flex h-full flex-col items-center justify-center border-risk/40 bg-risk/5 p-6 text-center">
              <AlertTriangle className="h-10 w-10 text-risk" />
              <h2 className="mt-3 text-sm font-semibold text-risk">Analysis Error</h2>
              <p className="mt-2 max-w-sm font-mono text-xs text-muted-foreground">{errorMsg}</p>
            </Panel>
          ) : (
            <EmptyStatePanel />
          )}
        </div>
      </div>

      {/* Scored Analytics & Forensic Dashboard */}
      {result ? (
        <div className="mt-6 space-y-6">
          <div className="grid items-stretch gap-6 lg:grid-cols-2">
            <ModelConsensusPanel result={result} viewModel={viewModel} />
            <FeatureAttributionPanel shap={result.shapWaterfall} real={result.shapReal} models={result.shapModels} />
          </div>
          <TransactionEvidencePanel tx={result.transaction} />
          <RecommendationPanel result={result} />
        </div>
      ) : null}
    </ModuleShell>
  );
}

function EmptyStatePanel() {
  return (
    <Panel delay={0.1} className="relative flex h-full min-h-[460px] flex-col justify-between overflow-hidden p-6 sm:p-7">
      <div className="flex items-center justify-between border-b border-white/6 pb-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan" />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            SOC Inference Engine
          </span>
        </div>
        <span className="rounded-full border border-safe/30 bg-safe/10 px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-safe">
          6 Models Online
        </span>
      </div>

      <div className="my-auto py-8 text-center">
        <div className="relative mx-auto h-24 w-24">
          <div className="absolute inset-0 rounded-full border border-cyan/20 animate-spin" style={{ animationDuration: "14s" }} />
          <div className="absolute inset-2 rounded-full border border-dashed border-violet/30 animate-spin" style={{ animationDirection: "reverse", animationDuration: "9s" }} />
          <div className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full glass-panel shadow-[0_0_24px_rgba(6,182,212,0.3)]">
            <Cpu className="h-7 w-7 text-cyan" />
          </div>
        </div>
        <h3 className="mt-5 text-sm font-semibold text-foreground">
          Ready for Forensic Transaction Analysis
        </h3>
        <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
          Select a quick scenario preset or enter parameters on the left, then trigger real-time AI scoring.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-white/6 pt-4 text-center">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Inference</div>
          <div className="mt-0.5 font-mono text-[11px] font-medium text-foreground">&lt; 2.0 ms</div>
        </div>
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Explainability</div>
          <div className="mt-0.5 font-mono text-[11px] font-medium text-foreground">Exact SHAP</div>
        </div>
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Enrichment</div>
          <div className="mt-0.5 font-mono text-[11px] font-medium text-foreground">ERC-20/721</div>
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 -bottom-20 h-32 opacity-20 blur-2xl"
        style={{ background: "var(--gradient-core)" }}
      />
    </Panel>
  );
}

function CircularRiskGauge({ value, level }: { value: number; level: string }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  const color =
    level === "high"
      ? "var(--risk)"
      : level === "elevated"
      ? "var(--warn)"
      : "var(--safe)";

  return (
    <div className="relative flex items-center justify-center shrink-0">
      <svg className="h-24 w-24 -rotate-90 transform" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth="7"
          fill="none"
        />
        <motion.circle
          cx="50"
          cy="50"
          r={radius}
          stroke={color}
          strokeWidth="7"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display text-lg font-bold tabular-nums">
          {value.toFixed(0)}
          <span className="text-[10px] font-normal text-muted-foreground">%</span>
        </span>
        <span className="font-mono text-[7px] uppercase tracking-wider text-muted-foreground">
          Risk Index
        </span>
      </div>
    </div>
  );
}

function VerdictHero({
  result,
  viewModel,
  onSelectModel,
}: {
  result: Result;
  viewModel: string;
  onSelectModel: (id: string) => void;
}) {
  const active = viewModel === "consensus" ? null : result.modelScores.find((m) => m.model_id === viewModel) ?? null;
  const displayVerdict = active ? active.verdict : result.verdict;
  const displayRisk = active ? Number((active.probability * 100).toFixed(1)) : result.risk;
  const level = levelFromVerdict(displayVerdict, displayRisk);
  const tone = level === "high" ? "text-risk" : level === "elevated" ? "text-warn" : "text-safe";
  const agreeing = active ? result.modelScores.filter((m) => m.verdict === active.verdict).length : 0;
  const isFraud = displayVerdict === "FRAUD" || level === "high";

  return (
    <Panel className="relative flex h-full flex-col justify-between overflow-hidden p-6 sm:p-7">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/6 pb-3.5">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
            <Activity className="h-3.5 w-3.5 text-cyan" />
            Verdict — {active ? active.name : "Ensemble Consensus"}
          </div>
          <RiskBadge level={level} />
        </div>

        {/* Model Switcher Chips */}
        {result.modelScores.length > 0 ? (
          <div className="mt-3.5 flex flex-wrap gap-1.5" role="tablist" aria-label="View verdict by model">
            <button
              role="tab"
              aria-selected={viewModel === "consensus"}
              onClick={() => onSelectModel("consensus")}
              className={cn(
                "rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition border",
                viewModel === "consensus"
                  ? "bg-cyan/15 text-cyan border-cyan/40 shadow-[0_0_10px_rgba(6,182,212,0.2)] font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/6 border-transparent",
              )}
            >
              Consensus
            </button>
            {result.modelScores.map((m) => (
              <button
                key={m.model_id}
                role="tab"
                aria-selected={viewModel === m.model_id}
                onClick={() => onSelectModel(m.model_id)}
                className={cn(
                  "rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition border",
                  viewModel === m.model_id
                    ? "bg-cyan/15 text-cyan border-cyan/40 shadow-[0_0_10px_rgba(6,182,212,0.2)] font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/6 border-transparent",
                )}
              >
                {m.name}
              </button>
            ))}
          </div>
        ) : null}

        {/* Big Glowing Verdict Title with Radial Risk Gauge */}
        <div className="mt-5 flex items-center justify-between gap-4">
          <div>
            <div className={cn("font-display text-3xl font-bold tracking-tight sm:text-4xl", tone)}>
              {verdictLabel(displayVerdict)}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {isFraud
                ? "Anomalous contract interaction or drain pattern detected."
                : "Standard transactional telemetry consistent with legitimate behaviour."}
            </p>
          </div>
          <CircularRiskGauge value={displayRisk} level={level} />
        </div>

        {/* 3-Column Key Metrics */}
        <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl border border-white/6 bg-white/2 p-3.5 sm:gap-4 sm:p-4">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              Fraud Score
            </div>
            <div className="mt-1 font-display text-lg font-semibold tabular-nums sm:text-xl">
              {displayRisk}
              <span className="text-xs font-normal text-muted-foreground"> /100</span>
            </div>
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              {active ? "Models Agree" : "Agreement"}
            </div>
            <div className="mt-1 font-display text-lg font-semibold tabular-nums sm:text-xl">
              {active ? `${agreeing}/${result.modelScores.length}` : `${(result.confidence * 100).toFixed(0)}%`}
            </div>
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              Latency
            </div>
            <div className="mt-1 font-display text-lg font-semibold tabular-nums sm:text-xl">
              {result.ms}
              <span className="text-xs font-normal text-muted-foreground"> ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Action Protocol Tag */}
      <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/4 p-3.5">
        <div className="flex items-center gap-2.5">
          {level === "high" ? (
            <ShieldAlert className="h-4 w-4 text-risk shrink-0" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-safe shrink-0" />
          )}
          <span className="text-xs font-medium text-foreground">
            {actionLabel(result.action)}
          </span>
        </div>
        <span className="truncate font-mono text-[10px] text-muted-foreground">
          {result.recommendations[0] ? short(result.recommendations[0], 28) : "Standard Operational Protocol"}
        </span>
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 -bottom-20 h-32 opacity-30 blur-2xl"
        style={{ background: "var(--gradient-core)" }}
      />
    </Panel>
  );
}

function ModelConsensusPanel({ result, viewModel }: { result: Result; viewModel: string }) {
  const scores = result.modelScores;
  const total = scores.length;
  const fraudVotes = scores.filter((m) => m.verdict === "FRAUD").length;
  const clearVotes = total - fraudVotes;

  return (
    <Panel delay={0.1} className="flex h-full flex-col justify-between p-6 sm:p-7">
      <div>
        <div className="flex items-center justify-between border-b border-white/6 pb-4">
          <div>
            <h2 className="text-sm font-semibold">Model Consensus Voting Map</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Multi-model agreement topology</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/6 px-2.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {clearVotes} Clear · {fraudVotes} Fraud
            </span>
            <span className="rounded-full bg-cyan/10 px-2.5 py-0.5 font-mono text-[10px] font-medium text-cyan">
              {(result.confidence * 100).toFixed(0)}% Agreement
            </span>
          </div>
        </div>

        {total === 0 ? (
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
            No per-model scores were returned for this transaction.
          </p>
        ) : (
          <div className="relative mx-auto mt-6 grid min-h-[340px] w-full max-w-[580px] place-items-center">
            <svg className="absolute inset-0 h-full w-full" aria-hidden>
              {scores.map((m, i) => {
                const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
                const x = 50 + Math.cos(angle) * 38;
                const y = 50 + Math.sin(angle) * 38;
                const fraud = m.verdict === "FRAUD";
                return (
                  <motion.line
                    key={m.model_id}
                    x1={`${x}%`}
                    y1={`${y}%`}
                    x2="50%"
                    y2="50%"
                    stroke={fraud ? "var(--risk)" : "var(--safe)"}
                    strokeWidth={1.4}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 0.85 }}
                    transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  />
                );
              })}
            </svg>

            {scores.map((m, i) => {
              const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
              const fraud = m.verdict === "FRAUD";
              const selected = viewModel === m.model_id;
              return (
                <motion.div
                  key={m.model_id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: selected ? 1.08 : 1 }}
                  transition={{ delay: i * 0.08 }}
                  className="absolute w-28 -translate-x-1/2 -translate-y-1/2 text-center"
                  style={{
                    left: `${50 + Math.cos(angle) * 38}%`,
                    top: `${50 + Math.sin(angle) * 38}%`,
                  }}
                >
                  <div
                    className="rounded-2xl glass-soft px-3 py-2.5 transition"
                    style={{
                      boxShadow: selected
                        ? `0 0 0 2px var(--cyan-accent), 0 0 22px -4px var(--cyan-accent)`
                        : `0 0 0 1px ${fraud ? "var(--risk)" : "var(--safe)"}`,
                    }}
                  >
                    <div className="text-[11px] font-medium truncate">{m.name}</div>
                    <div
                      className={`mt-1 font-mono text-[10px] uppercase tracking-[0.14em] ${fraud ? "text-risk" : "text-safe"}`}
                    >
                      {fraud ? "fraud" : "clear"} · {(m.probability * 100).toFixed(0)}%
                    </div>
                  </div>
                </motion.div>
              );
            })}

            <div className="relative z-10 grid h-28 w-28 place-items-center rounded-full glass-panel text-center shadow-[0_0_30px_rgba(6,182,212,0.2)]">
              <Network className="mx-auto h-4 w-4 text-cyan" strokeWidth={1.6} />
              <div className="mt-1 font-display text-xl font-semibold tabular-nums">
                {(result.confidence * 100).toFixed(0)}%
              </div>
              <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
                agreement
              </div>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

function FeatureAttributionPanel({
  shap,
  real,
  models,
}: {
  shap: Result["shapWaterfall"];
  real: boolean;
  models: string[];
}) {
  return (
    <Panel delay={0.16} className="flex h-full flex-col justify-between p-6 sm:p-7">
      <div>
        <div className="flex items-center justify-between border-b border-white/6 pb-4">
          <div>
            <h2 className="text-sm font-semibold">
              {real ? "SHAP Explainability Waterfall" : "Feature Attribution Waterfall"}
            </h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {real ? `Exact Shapley attributions across ${models.length} models` : "Heuristic importance weights"}
            </p>
          </div>
          <span className="rounded-full bg-cyan/10 px-2.5 py-0.5 font-mono text-[10px] font-medium text-cyan">
            {real ? "Exact Shapley" : "Heuristic"}
          </span>
        </div>

        {shap.length > 0 ? (
          <ul className="mt-4 space-y-3.5">
            {shap.map((f) => {
              const meta = formatFeatureName(f.feature);
              const isPositive = f.shap_value > 0;

              return (
                <li key={f.feature} className="rounded-xl border border-white/4 bg-white/2 p-3 transition hover:bg-white/4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-medium text-foreground">{meta.title}</div>
                      <div className="text-[10px] text-muted-foreground">{meta.subtitle}</div>
                    </div>
                    <span
                      className={cn(
                        "font-mono text-xs font-semibold tabular-nums shrink-0",
                        isPositive ? "text-risk" : "text-safe",
                      )}
                    >
                      {isPositive ? "+" : ""}
                      {Number(f.shap_value).toFixed(3)}
                    </span>
                  </div>

                  <div className="mt-2.5">
                    <Meter
                      value={Math.min(100, Math.abs(f.shap_value) * 220)}
                      tone={isPositive ? "risk" : "safe"}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            Feature attribution unavailable for this transaction.
          </p>
        )}
      </div>
    </Panel>
  );
}

function TransactionEvidencePanel({ tx }: { tx: TransactionMeta | null }) {
  if (!tx) {
    return (
      <Panel delay={0.22}>
        <h2 className="text-sm font-semibold">What was analyzed</h2>
        <p className="mt-4 text-xs text-muted-foreground">
          Transaction metadata was not returned for this request.
        </p>
      </Panel>
    );
  }

  const fields: Array<[string, string, string | null]> = [
    ["Transaction Hash", tx.hash, tx.hash],
    ["Block Number", `#${tx.block_number.toLocaleString()}`, null],
    ["Block Timestamp", new Date(tx.timestamp * 1000).toLocaleString(), null],
    ["From Address (Sender)", tx.from_address, tx.from_address],
    ["To Address (Contract)", tx.to_address ?? "Contract creation", tx.to_address],
    ["Transfer Value", `${tx.value_eth} ETH`, null],
    ["Gas Consumed", tx.gas_used.toLocaleString(), null],
    ["Effective Gas Price", `${tx.effective_gas_price_gwei} gwei`, null],
  ];

  return (
    <Panel delay={0.22} className="p-6 sm:p-7">
      <div className="flex items-center justify-between border-b border-white/6 pb-4">
        <div>
          <h2 className="text-sm font-semibold">Transaction Forensic Evidence</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Immutable on-chain parameters evaluated</p>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">Audit Record</span>
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map(([label, value, copyValue]) => (
          <div key={label} className="rounded-2xl border border-white/6 bg-white/2 p-3.5">
            <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              {label}
            </dt>
            <dd className="mt-1.5 flex items-center justify-between gap-2 break-all font-mono text-xs text-foreground">
              <span className="truncate">{value}</span>
              {copyValue ? (
                <button
                  onClick={() => copy(copyValue, label)}
                  className="shrink-0 text-muted-foreground/60 transition hover:text-cyan"
                  aria-label={`Copy ${label}`}
                  title="Copy to clipboard"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function RecommendationPanel({ result }: { result: Result }) {
  const level = levelFromVerdict(result.verdict, result.risk);
  return (
    <Panel delay={0.28} className="p-6 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/6 pb-4">
        <div>
          <h2 className="text-sm font-semibold">SOC Incident Guidance & Security Protocol</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Automated threat response playbook actions</p>
        </div>
        <div className="flex items-center gap-2">
          <RiskBadge level={level} />
          <span className="rounded-full glass-soft px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em]">
            {actionLabel(result.action)}
          </span>
        </div>
      </div>

      <div className="mt-5 space-y-3 text-sm leading-relaxed text-muted-foreground">
        {result.recommendations.length > 0 ? (
          result.recommendations.map((rec, i) => (
            <div key={i} className="flex items-start gap-3.5 rounded-2xl border border-white/4 bg-white/2 p-4">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan/15 text-xs font-semibold text-cyan">
                {i + 1}
              </span>
              <p className="text-xs text-foreground/90 leading-relaxed">{rec}</p>
            </div>
          ))
        ) : (
          <p className="text-xs">No specific incident recommendations required for this transaction.</p>
        )}
      </div>
    </Panel>
  );
}
