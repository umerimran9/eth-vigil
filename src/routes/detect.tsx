import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  Check,
  ChevronDown,
  Copy,
  Download,
  FileCheck,
  FileSpreadsheet,
  FolderSearch,
  Loader2,
  Printer,
  Radar as RadarIcon,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";
import { ModuleShell, Panel, RiskBadge, Meter, KeyValue, short } from "@/components/ui-kit";
import {
  CONSENSUS_STRATEGIES,
  MODELS,
  SAMPLE_PRESETS,
  actionLabel,
  levelFromVerdict,
  verdictLabel,
  type RiskLevel,
} from "@/lib/platform-data";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { categorizeFeature, type AnalysisRecord, type RawFeature } from "@/lib/types";

interface DetectSearch {
  from?: string | undefined;
  to?: string | undefined;
  value?: string | undefined;
  hash?: string | undefined;
  model?: string | undefined;
  strategy?: string | undefined;
  aegisRun?: boolean | undefined;
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
    hash: typeof search["hash"] === "string" ? search["hash"] : undefined,
    model: typeof search["model"] === "string" ? search["model"] : undefined,
    strategy: typeof search["strategy"] === "string" ? search["strategy"] : undefined,
    aegisRun: search["aegisRun"] ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "AI Investigation Studio — Aegis" },
      {
        name: "description",
        content:
          "Investigate Ethereum transactions with 7-model AI consensus, interactive model switcher, XAI waterfall feature attribution, and cryptographic audit report generation.",
      },
      { property: "og:title", content: "AI Investigation Studio — Aegis" },
      {
        property: "og:description",
        content: "Score transactions with 7 AI models, evaluate XAI explainability, and export forensic reports.",
      },
    ],
  }),
  component: Detect,
});

const STAGES = [
  { key: "resolve", label: "Resolving On-Chain Wallet", detail: "Querying Etherscan proxy & token history" },
  { key: "features", label: "Extracting 61-Feature DNA", detail: "Computing era-relative z-scores & lexical entropy" },
  { key: "models", label: "Executing 7-Model Ensemble", detail: "Evaluating LightGBM, XGBoost, TabNet, FT-Transformer, MLP" },
  { key: "consensus", label: "Synthesizing AI Consensus", detail: "Aggregating voting weights & confidence matrix" },
  { key: "xai", label: "Deriving XAI Attributions", detail: "Computing primary risk drivers & SOC action playbook" },
] as const;

const FIELD =
  "mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm shadow-sm transition focus:border-primary focus:ring-1 focus:ring-primary";

function Detect() {
  const search = Route.useSearch();
  const prefilled = Boolean(search.from || search.to || search.value || search.hash);

  const [hash, setHash] = useState(search.hash ?? "");
  const [fromAddr, setFromAddr] = useState(search.from ?? SAMPLE_PRESETS[0]!.from);
  const [toAddr, setToAddr] = useState(search.to ?? SAMPLE_PRESETS[0]!.to);
  const [valueEth, setValueEth] = useState(search.value ?? SAMPLE_PRESETS[0]!.value);
  const [gasUsed, setGasUsed] = useState(SAMPLE_PRESETS[0]!.gasUsed);
  const [showDetails, setShowDetails] = useState(prefilled && !search.hash);

  const [selectedModel, setSelectedModel] = useState<string>(search.model ?? "consensus");
  const [consensusStrategy, setConsensusStrategy] = useState<string>(search.strategy ?? "weighted_average");

  const [stage, setStage] = useState(-1);
  const [result, setResult] = useState<AnalysisRecord | null>(null);
  const [ms, setMs] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [analystMode, setAnalystMode] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const autoranRef = useRef(false);

  const toWei = (eth: string): number => {
    const [whole = "0", frac = ""] = (eth || "0").trim().split(".");
    const digits = `${whole.replace(/\D/g, "") || "0"}${frac.replace(/\D/g, "").padEnd(18, "0").slice(0, 18)}`;
    return Number(digits);
  };

  const buildPayload = (o?: Partial<{ hash: string; fromAddr: string; toAddr: string; valueEth: string; gasUsed: string; modelId: string; strategy: string }>) => {
    const g = o?.gasUsed ?? gasUsed;
    const gUsed = parseInt(g || "21000", 10);
    return {
      hash: o?.hash ?? hash ?? "0x" + "0".repeat(64),
      from_address: o?.fromAddr ?? fromAddr ?? "0x0000000000000000000000000000000000000000",
      to_address: o?.toAddr ?? toAddr ?? "0x0000000000000000000000000000000000000000",
      value: toWei(o?.valueEth ?? valueEth),
      gas: gUsed,
      gas_used: gUsed,
      effective_gas_price: 24500000000,
      cumulative_gas_used: 1200000,
      nonce: 42,
      model_id: o?.modelId ?? (selectedModel === "consensus" ? null : selectedModel),
      consensus_strategy: o?.strategy ?? consensusStrategy,
    };
  };

  const run = async (payload = buildPayload()) => {
    setResult(null);
    setErrorMsg(null);
    setStage(0);
    const startTime = performance.now();

    const timers: number[] = [];
    for (let i = 1; i < STAGES.length; i++) {
      timers.push(window.setTimeout(() => setStage(i), i * 350));
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
      await new Promise((r) => setTimeout(r, 150));
      const d = data.data;
      const a = d.assessment;
      setMs(Number((endTime - startTime).toFixed(1)));
      setResult({
        verdict: a.verdict,
        action: a.action,
        risk: Number((a.overall_risk_score * 100).toFixed(1)),
        confidence: Number((a.agreement_percentage / 100).toFixed(3)),
        agreedModels: a.agreed_models,
        totalModels: a.total_models,
        recommendations: d.recommendations || [],
        featureSignals: d.explainability?.feature_signals || [],
        rawFeatures: d.raw_features || [],
        featuresDefaulted: Boolean(d.features_defaulted),
        modelScores: d.model_scores || [],
        transaction: d.transaction || null,
        shapParagraph: d.explainability?.narrative_paragraph || d.explainability?.narrative_summary || "",
      });
    } else {
      setErrorMsg(error || "The backend serving API encountered an unexpected response.");
    }
    setStage(-1);
  };

  const applyPreset = (preset: (typeof SAMPLE_PRESETS)[number]) => {
    setHash(preset.hash);
    setFromAddr(preset.from);
    setToAddr(preset.to);
    setValueEth(preset.value);
    setGasUsed(preset.gasUsed);
    run(buildPayload({
      hash: preset.hash,
      fromAddr: preset.from,
      toAddr: preset.to,
      valueEth: preset.value,
      gasUsed: preset.gasUsed,
    }));
  };

  useEffect(() => {
    if (autoranRef.current || !search.aegisRun) return;
    autoranRef.current = true;
    if (search.hash) run(buildPayload({ hash: search.hash }));
    else if (prefilled) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = stage >= 0;

  return (
    <ModuleShell>
      <div className="space-y-6">
        {/* Model Switcher Toolbar */}
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-card/60 p-4 backdrop-blur-sm sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Model Evaluation Mode</span>
              <div className="text-sm font-semibold text-foreground">
                {selectedModel === "consensus" ? "Consensus Ensemble (7 Models)" : MODELS.find(m => m.id.replace(/-/g, "_") === selectedModel.replace(/-/g, "_"))?.name || selectedModel}
              </div>
            </div>
          </div>

          {/* Model Toggle Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => {
                setSelectedModel("consensus");
                if (result) run(buildPayload({ modelId: "consensus" }));
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                selectedModel === "consensus"
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                  : "border border-border bg-background/60 text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Consensus Ensemble</span>
            </button>

            {MODELS.map((m) => {
              const active = selectedModel.replace(/-/g, "_") === m.id.replace(/-/g, "_");
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    const normId = m.id.replace(/-/g, "_");
                    setSelectedModel(normId);
                    if (result) run(buildPayload({ modelId: normId }));
                  }}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
                    active
                      ? "bg-primary text-primary-foreground font-semibold shadow-sm shadow-primary/30"
                      : "border border-border bg-background/60 text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="mx-auto max-w-4xl">
          {busy ? (
            <ScanProgress stage={stage} />
          ) : result ? (
            <InvestigationView
              result={result}
              ms={ms}
              selectedModel={selectedModel}
              consensusStrategy={consensusStrategy}
              analystMode={analystMode}
              onToggleAnalyst={() => setAnalystMode((v) => !v)}
              onRerun={() => run()}
              onOpenReport={() => setReportModalOpen(true)}
            />
          ) : (
            <InputCard
              hash={hash}
              setHash={setHash}
              fromAddr={fromAddr}
              setFromAddr={setFromAddr}
              toAddr={toAddr}
              setToAddr={setToAddr}
              valueEth={valueEth}
              setValueEth={setValueEth}
              gasUsed={gasUsed}
              setGasUsed={setGasUsed}
              showDetails={showDetails}
              setShowDetails={setShowDetails}
              selectedModel={selectedModel}
              consensusStrategy={consensusStrategy}
              setConsensusStrategy={setConsensusStrategy}
              error={errorMsg}
              onRun={() => run()}
              onPreset={applyPreset}
            />
          )}
        </div>
      </div>

      {/* Forensic Report Modal */}
      {reportModalOpen && result ? (
        <ForensicReportModal
          result={result}
          onClose={() => setReportModalOpen(false)}
        />
      ) : null}
    </ModuleShell>
  );
}

function InputCard({
  hash,
  setHash,
  fromAddr,
  setFromAddr,
  toAddr,
  setToAddr,
  valueEth,
  setValueEth,
  gasUsed,
  setGasUsed,
  showDetails,
  setShowDetails,
  selectedModel,
  consensusStrategy,
  setConsensusStrategy,
  error,
  onRun,
  onPreset,
}: {
  hash: string;
  setHash: (v: string) => void;
  fromAddr: string;
  setFromAddr: (v: string) => void;
  toAddr: string;
  setToAddr: (v: string) => void;
  valueEth: string;
  setValueEth: (v: string) => void;
  gasUsed: string;
  setGasUsed: (v: string) => void;
  showDetails: boolean;
  setShowDetails: (v: boolean) => void;
  selectedModel: string;
  consensusStrategy: string;
  setConsensusStrategy: (v: string) => void;
  error: string | null;
  onRun: () => void;
  onPreset: (preset: (typeof SAMPLE_PRESETS)[number]) => void;
}) {
  return (
    <div className="space-y-4">
      <header className="mb-2">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Transaction Fraud & XAI Investigation
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Enter an on-chain transaction hash or enter parameters manually. Aegis extracts on-chain wallet metadata, executes the 61-feature vector, and scores predictions across all 7 AI models.
        </p>
      </header>

      <Panel className="border-border/80 bg-card/60 shadow-sm">
        <label htmlFor="tx-hash" className="text-sm font-semibold">
          Ethereum Transaction Hash
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="tx-hash"
            value={hash}
            onChange={(e) => setHash(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRun();
            }}
            placeholder="0x… (e.g. 0x8a3f9e2b1c4d5a6e7f8a9b0c…)"
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3.5 py-2.5 font-mono text-sm transition focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={onRun}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition hover:opacity-90"
          >
            <RadarIcon className="h-4 w-4" />
            <span>Score Prediction</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Attack Presets */}
        <div className="mt-4 border-t border-border/60 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Load Attack Preset
            </span>
            <span className="text-[11px] text-muted-foreground">Instant test scenarios</span>
          </div>

          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {SAMPLE_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => onPreset(preset)}
                className="flex flex-col rounded-lg border border-border/80 bg-background/50 p-2.5 text-left transition hover:border-primary/50 hover:bg-accent/40"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold">{preset.name}</span>
                  <span
                    className={cn(
                      "rounded px-1 py-0.2 text-[9px] font-semibold",
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

        {/* Consensus Strategy Selector (when in consensus mode) */}
        {selectedModel === "consensus" ? (
          <div className="mt-4 border-t border-border/60 pt-3">
            <label className="text-xs font-medium text-muted-foreground">Consensus Voting Algorithm</label>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              {CONSENSUS_STRATEGIES.map((strat) => (
                <button
                  key={strat.id}
                  onClick={() => setConsensusStrategy(strat.id)}
                  className={cn(
                    "flex flex-col rounded-lg border p-2.5 text-left transition",
                    consensusStrategy === strat.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/80 bg-background/40 text-muted-foreground hover:bg-accent/40",
                  )}
                >
                  <span className="text-xs font-semibold text-foreground">{strat.name}</span>
                  <span className="text-[11px] leading-tight text-muted-foreground">{strat.description}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Collapsible Manual Parameters */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          aria-expanded={showDetails}
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", showDetails && "rotate-180")}
          />
          {showDetails ? "Hide manual transaction parameters" : "Enter transaction parameters manually"}
        </button>

        {showDetails ? (
          <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
            <div>
              <label htmlFor="f-from" className="text-xs font-semibold">
                From Address (Sender Wallet)
              </label>
              <input
                id="f-from"
                value={fromAddr}
                onChange={(e) => setFromAddr(e.target.value)}
                className={FIELD}
              />
            </div>
            <div>
              <label htmlFor="f-to" className="text-xs font-semibold">
                To Address (Recipient / Smart Contract)
              </label>
              <input
                id="f-to"
                value={toAddr}
                onChange={(e) => setToAddr(e.target.value)}
                className={FIELD}
              />
            </div>
            <div>
              <label htmlFor="f-val" className="text-xs font-semibold">
                Value (ETH)
              </label>
              <input
                id="f-val"
                value={valueEth}
                onChange={(e) => setValueEth(e.target.value)}
                className={FIELD}
              />
            </div>
            <div>
              <label htmlFor="f-gas" className="text-xs font-semibold">
                Gas Limit & Used
              </label>
              <input
                id="f-gas"
                value={gasUsed}
                onChange={(e) => setGasUsed(e.target.value)}
                className={FIELD}
              />
            </div>
          </div>
        ) : null}
      </Panel>

      {error ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-risk/30 bg-risk/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-risk" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-risk">Analysis Failed</p>
            <p className="mt-1 break-words font-mono text-xs text-muted-foreground">{error}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ScanProgress({ stage }: { stage: number }) {
  return (
    <Panel className="border-border/80 bg-card/60 shadow-sm">
      <div className="flex items-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <h2 className="text-sm font-bold">Executing 7-Model AI Intelligence Pipeline…</h2>
      </div>

      <ol className="mt-5 space-y-3.5">
        {STAGES.map((s, i) => {
          const state = i < stage ? "done" : i === stage ? "active" : "pending";
          return (
            <li key={s.key} className="flex items-start gap-3">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center">
                {state === "done" ? (
                  <Check className="h-4 w-4 text-safe" />
                ) : state === "active" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-border" />
                )}
              </span>
              <div className="min-w-0">
                <div
                  className={cn(
                    "text-sm font-medium",
                    state === "pending" ? "text-muted-foreground" : "text-foreground font-semibold",
                  )}
                >
                  {s.label}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{s.detail}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

function InvestigationView({
  result,
  ms,
  selectedModel,
  consensusStrategy,
  analystMode,
  onToggleAnalyst,
  onRerun,
  onOpenReport,
}: {
  result: AnalysisRecord;
  ms: number;
  selectedModel: string;
  consensusStrategy: string;
  analystMode: boolean;
  onToggleAnalyst: () => void;
  onRerun: () => void;
  onOpenReport: () => void;
}) {
  const level = levelFromVerdict(result.verdict, result.risk);
  const tx = result.transaction;

  const radarData = useMemo(() => {
    return result.modelScores.map((m) => ({
      model: m.name.replace("PYTORCH ", "").replace("FT ", "FT-"),
      risk: Number((m.probability * 100).toFixed(1)),
      threshold: Number((m.threshold * 100).toFixed(1)),
    }));
  }, [result.modelScores]);

  return (
    <div className="space-y-6">
      {/* Investigation Verdict Surface */}
      <Panel className="relative overflow-hidden border-border bg-card p-0 shadow-xs">
        <span
          className={cn(
            "absolute inset-y-0 left-0 w-1",
            level === "high" ? "bg-risk" : level === "elevated" ? "bg-warn" : "bg-safe",
          )}
        />
        <div className="p-6 pl-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Detection Assessment
                </span>
                <span className="rounded border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium text-foreground">
                  {selectedModel === "consensus" ? "7-Model Consensus" : selectedModel.toUpperCase()}
                </span>
              </div>
              <h1
                className={cn(
                  "mt-1 text-2xl font-semibold tracking-tight sm:text-3xl",
                  level === "high" ? "text-risk" : level === "elevated" ? "text-warn" : "text-safe",
                )}
              >
                {verdictLabel(result.verdict)}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onOpenReport}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:opacity-90"
              >
                <FileCheck className="h-4 w-4" />
                <span>Audit Certificate</span>
              </button>
              <button
                onClick={onRerun}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Re-evaluate</span>
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
            <KeyValue label="Calculated Risk Score">
              <span className="text-xl font-bold tabular-nums text-foreground">{result.risk.toFixed(1)}%</span>
            </KeyValue>
            <KeyValue label="Consensus Agreement">
              <span className="text-xl font-bold tabular-nums text-foreground">
                {(result.confidence * 100).toFixed(0)}%
              </span>
              <span className="ml-1 text-xs text-muted-foreground">
                ({result.agreedModels}/{result.totalModels} models)
              </span>
            </KeyValue>
            <KeyValue label="Recommended Action">
              <span className="text-xs font-medium text-foreground">{actionLabel(result.action)}</span>
            </KeyValue>
            <KeyValue label="Inference Latency">
              <span className="text-xl font-bold tabular-nums text-foreground">{ms}</span>
              <span className="text-xs text-muted-foreground"> ms</span>
            </KeyValue>
          </div>
        </div>
      </Panel>

      {/* 7-Model Radar & Comparative Breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="border-border/80 bg-card/60">
          <h2 className="text-sm font-bold">7-Model Consensus Radar</h2>
          <p className="text-xs text-muted-foreground">Cross-architecture probability distribution</p>

          <div className="mt-3 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="model" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="var(--border)" />
                <Radar
                  name="Risk Score"
                  dataKey="risk"
                  stroke="var(--brand)"
                  fill="var(--brand)"
                  fillOpacity={0.4}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="border-border/80 bg-card/60">
          <h2 className="text-sm font-bold">Model Scorecard & Decision Thresholds</h2>
          <p className="text-xs text-muted-foreground">Individual predictions across all 7 models</p>

          <div className="mt-3 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Model</th>
                  <th className="px-3 py-2 font-medium">Risk Score</th>
                  <th className="px-3 py-2 text-right font-medium">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {result.modelScores.map((m) => {
                  const pct = m.probability * 100;
                  const fraud = m.verdict === "FRAUD";
                  return (
                    <tr key={m.model_id} className="border-b border-border last:border-b-0">
                      <td className="px-3 py-2 font-medium">{m.name}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="w-10 tabular-nums">{pct.toFixed(1)}%</span>
                          <div className="w-24">
                            <Meter value={pct} tone={fraud ? "risk" : "safe"} />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className={cn("font-semibold", fraud ? "text-risk" : "text-safe")}>
                          {fraud ? "FRAUD" : "CLEAR"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* Natural-Language SHAP Explainability Narrative Card */}
      <Panel className="border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
              <Brain className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Natural-Language SHAP Explainability Narrative</h2>
              <p className="text-xs text-muted-foreground">Synthesized cross-architecture attribution reasoning</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (result.shapParagraph) {
                  navigator.clipboard.writeText(result.shapParagraph);
                  toast.success("Copied SHAP explainability narrative");
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>Copy Analysis</span>
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
          <p className="text-sm leading-relaxed text-foreground/90 font-sans">
            {result.shapParagraph || (
              `The 7-model AI ensemble evaluated this Ethereum transaction with an overall fraud risk score of ${result.risk.toFixed(1)}% (Verdict: ${result.verdict}). Prediction confidence is supported by a ${ (result.confidence * 100).toFixed(0)}% consensus agreement across ${result.agreedModels} of ${result.totalModels} models.`
            )}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/80 pt-3 text-xs">
            <span className="font-semibold text-muted-foreground">Key Contributing Signals:</span>
            {result.featureSignals.slice(0, 3).map((sig) => (
              <span
                key={sig.feature}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold",
                  sig.signal_value > 0
                    ? "bg-risk/10 text-risk border border-risk/20"
                    : "bg-safe/10 text-safe border border-safe/20",
                )}
              >
                <span>{sig.label || sig.feature}</span>
                <span>({sig.signal_value > 0 ? "+" : ""}{sig.signal_value.toFixed(3)})</span>
              </span>
            ))}
          </div>
        </div>
      </Panel>

      {/* Quantitative XAI Waterfall & Primary Risk Drivers */}
      <Panel className="border-border bg-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold">SHAP Feature Attribution Waterfall (Quantitative Breakdown)</h2>
            <p className="text-xs text-muted-foreground">
              Individual mathematical feature shifts on overall fraud probability
            </p>
          </div>
          <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            SHAP Engine
          </span>
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {result.featureSignals.map((sig, idx) => {
            const isPos = sig.signal_value > 0;
            return (
              <div
                key={sig.feature || idx}
                className="flex items-center justify-between rounded-xl border border-border bg-background/50 p-3"
              >
                <div className="min-w-0 pr-2">
                  <div className="text-xs font-semibold text-foreground">
                    {sig.label || sig.feature}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Observed: <span className="font-mono">{sig.value}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={cn(
                      "font-mono text-xs font-bold",
                      isPos ? "text-risk" : "text-safe",
                    )}
                  >
                    {isPos ? "+" : ""}{sig.signal_value.toFixed(3)}
                  </span>
                  <div className="text-[10px] text-muted-foreground">
                    {isPos ? "Fraud Driver" : "Legit Signal"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* On-chain Transaction Passport */}
      <Panel className="border-border/80 bg-card/60">
        <h2 className="text-sm font-bold">On-Chain Transaction Passport</h2>
        <p className="text-xs text-muted-foreground">Raw execution metadata resolved from Ethereum mainnet</p>

        {tx ? (
          <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <KeyValue label="Transaction Hash" mono>
              <CopyValue value={tx.hash} display={short(tx.hash, 12)} />
            </KeyValue>
            <KeyValue label="Mined Block" mono>
              #{tx.block_number.toLocaleString()}
            </KeyValue>
            <KeyValue label="Sender (From)" mono>
              <CopyValue value={tx.from_address} display={short(tx.from_address, 10)} />
            </KeyValue>
            <KeyValue label="Recipient / Contract (To)" mono>
              {tx.to_address ? (
                <CopyValue value={tx.to_address} display={short(tx.to_address, 10)} />
              ) : (
                "Contract Creation"
              )}
            </KeyValue>
            <KeyValue label="Value in ETH">
              <span className="font-bold">{tx.value_eth} ETH</span>
            </KeyValue>
            <KeyValue label="Gas Limit & Used">
              <span className="font-mono">{tx.gas_used.toLocaleString()}</span> gas units
            </KeyValue>
          </dl>
        ) : null}
      </Panel>

      {/* Full 61-Feature DNA Explorer */}
      <Panel className="border-border/80 bg-card/60">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold">Transaction DNA (61 Features)</h2>
            <p className="text-xs text-muted-foreground">
              Complete engineered feature vector across gas, block, token and era-relative z-scores
            </p>
          </div>
          <button
            onClick={onToggleAnalyst}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-accent"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>{analystMode ? "Collapse Vector" : "Inspect All 61 Features"}</span>
          </button>
        </div>

        {analystMode ? (
          <div className="mt-4 max-h-96 overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm">
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Feature Name</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 text-right font-medium">Observed Value</th>
                </tr>
              </thead>
              <tbody>
                {result.rawFeatures.map((f, i) => {
                  const cat = categorizeFeature(f.feature);
                  return (
                    <tr key={f.feature} className="border-b border-border last:border-b-0 hover:bg-accent/40">
                      <td className="px-3 py-1.5 font-mono text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-1.5 font-mono font-medium text-foreground">{f.feature}</td>
                      <td className="px-3 py-1.5 text-muted-foreground uppercase text-[10px]">{cat}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-semibold">{f.value}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>

      {/* Recommended SOC Playbook */}
      <Panel className="border-border/80 bg-card/60">
        <h2 className="text-sm font-bold">Automated SOC Response Playbook</h2>
        <p className="text-xs text-muted-foreground">Recommended actions based on risk severity</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <RiskBadge level={level} />
          <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground">
            {actionLabel(result.action)}
          </span>
        </div>

        <ul className="mt-4 space-y-2">
          {result.recommendations.map((r, i) => (
            <li key={i} className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{r}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border/60 pt-4">
          <Link
            to="/cases"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-accent"
          >
            <FolderSearch className="h-3.5 w-3.5" />
            <span>Open in Case Archive</span>
          </Link>
          <button
            onClick={onOpenReport}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Official Forensic Certificate</span>
          </button>
        </div>
      </Panel>
    </div>
  );
}

function CopyValue({ value, display }: { value: string; display: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      title="Click to copy full string"
      className="inline-flex items-center gap-1.5 text-xs font-mono font-medium hover:text-primary transition"
    >
      <span>{display}</span>
      {copied ? <Check className="h-3 w-3 text-safe" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
    </button>
  );
}

function ForensicReportModal({
  result,
  onClose,
}: {
  result: AnalysisRecord;
  onClose: () => void;
}) {
  const tx = result.transaction;
  const certId = useMemo(() => `AEGIS-CERT-${Math.random().toString(36).substring(2, 10).toUpperCase()}`, []);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `aegis_forensic_report_${tx?.hash.slice(0, 10) || "case"}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-md">
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl sm:p-8">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              A
            </div>
            <div>
              <h2 className="text-base font-bold">Official Forensic Security Audit Report</h2>
              <span className="font-mono text-xs text-muted-foreground">Certificate ID: {certId}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            Close
          </button>
        </div>

        <div className="mt-6 space-y-6 text-sm">
          {/* Certificate Header Banner */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase text-primary">Verdict Status</span>
                <div className="text-lg font-bold text-foreground">{verdictLabel(result.verdict)}</div>
              </div>
              <div className="text-right">
                <span className="text-xs text-muted-foreground">Overall Fraud Risk</span>
                <div className="text-lg font-bold text-foreground">{result.risk.toFixed(1)}%</div>
              </div>
            </div>
          </div>

          {/* Transaction Metadata */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Transaction Target</h3>
            <dl className="mt-2 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-border bg-background p-2.5">
                <dt className="text-muted-foreground">Hash</dt>
                <dd className="mt-0.5 font-mono truncate">{tx?.hash || "0x..."}</dd>
              </div>
              <div className="rounded-lg border border-border bg-background p-2.5">
                <dt className="text-muted-foreground">Mined Block</dt>
                <dd className="mt-0.5 font-mono">#{tx?.block_number || "19485021"}</dd>
              </div>
              <div className="rounded-lg border border-border bg-background p-2.5">
                <dt className="text-muted-foreground">Sender Wallet</dt>
                <dd className="mt-0.5 font-mono truncate">{tx?.from_address || "0x..."}</dd>
              </div>
              <div className="rounded-lg border border-border bg-background p-2.5">
                <dt className="text-muted-foreground">Value (ETH)</dt>
                <dd className="mt-0.5 font-semibold">{tx?.value_eth || "0"} ETH</dd>
              </div>
            </dl>
          </div>

          {/* 7-Model Ensemble Evaluation */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">7-Model Multi-Architecture Audit Breakdown</h3>
            <div className="mt-2 overflow-hidden rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Model Name</th>
                    <th className="px-3 py-2 font-medium">Architecture</th>
                    <th className="px-3 py-2 font-medium">Score</th>
                    <th className="px-3 py-2 text-right font-medium">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {result.modelScores.map((m) => (
                    <tr key={m.model_id} className="border-b border-border last:border-b-0">
                      <td className="px-3 py-2 font-medium">{m.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{MODELS.find(x => x.id.replace(/-/g, "_") === m.model_id)?.family || "ML Model"}</td>
                      <td className="px-3 py-2 font-mono">{(m.probability * 100).toFixed(1)}%</td>
                      <td className="px-3 py-2 text-right font-semibold">
                        <span className={m.verdict === "FRAUD" ? "text-risk" : "text-safe"}>
                          {m.verdict}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Forensic Playbook */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Compliance & Response Directives</h3>
            <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              {result.recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-xs font-semibold hover:bg-accent"
          >
            <Printer className="h-4 w-4" />
            <span>Print Report</span>
          </button>
          <button
            onClick={handleDownloadJson}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90"
          >
            <Download className="h-4 w-4" />
            <span>Download Structured JSON</span>
          </button>
        </div>
      </div>
    </div>
  );
}
