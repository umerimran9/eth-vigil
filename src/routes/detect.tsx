import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { AlertTriangle, Copy, Cpu, Hash, Network, PlayCircle, Sliders, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Meter, ModuleShell, PageHeader, Panel, RiskBadge, StatTile } from "@/components/ui-kit";
import { actionLabel, levelFromVerdict, MODELS, verdictLabel } from "@/lib/platform-data";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface DetectSearch {
  from?: string | undefined;
  to?: string | undefined;
  value?: string | undefined;
}

export const Route = createFileRoute("/detect")({
  validateSearch: (search: Record<string, unknown>): DetectSearch => ({
    from: typeof search["from"] === "string" ? search["from"] : undefined,
    to: typeof search["to"] === "string" ? search["to"] : undefined,
    value: typeof search["value"] === "string" ? search["value"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Fraud Detection — Aegis" },
      {
        name: "description",
        content:
          "Score any Ethereum transaction by hash or manual features. One investigation: verdict, model consensus, feature attribution, transaction evidence and a recommended action.",
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

// Matches the real call order in WebApp/app.py's analyze_transaction (token
// lookup -> feature build -> predict_all -> compute_consensus ->
// explain_prediction). Everything before the response lands is shown as
// "in progress," never "done" -- only the response itself proves the
// pipeline completed.
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
  /** true when the values are exact Shapley, false when the heuristic table. */
  shapReal: boolean;
  shapModels: string[];
  featuresDefaulted: boolean;
  modelScores: ModelScore[];
  transaction: TransactionMeta | null;
}

const DEMO = {
  fromAddr: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
  toAddr: "0x1111111254fb6c44bac0bed2854e76f90643097d",
  valueEth: "1.45",
  gasUsed: "21000",
};

const copy = (text: string, label: string) => {
  navigator.clipboard?.writeText(text).then(() => toast.success(`${label} copied`));
};

function Detect() {
  const search = Route.useSearch();
  const prefilled = Boolean(search.from || search.to || search.value);

  const [mode, setMode] = useState<"hash" | "manual">(prefilled ? "manual" : "hash");
  const [hash, setHash] = useState("");
  const [fromAddr, setFromAddr] = useState(search.from ?? DEMO.fromAddr);
  const [toAddr, setToAddr] = useState(search.to ?? DEMO.toAddr);
  const [valueEth, setValueEth] = useState(search.value ?? DEMO.valueEth);
  const [gasUsed, setGasUsed] = useState(DEMO.gasUsed);

  const [selectedModel, setSelectedModel] = useState<string>("consensus");
  const [stage, setStage] = useState(-1);
  const [result, setResult] = useState<Result | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [viewModel, setViewModel] = useState<string>("consensus");
  // The model the last request was scored through. Distinct from viewModel so
  // the chips can show a pending selection while the re-run is in flight.
  const [scoredBy, setScoredBy] = useState<string>("consensus");
  // The on-chain payload a pasted hash resolved to, so the UI can show the
  // real values it is about to score rather than the form's defaults.
  const [resolved, setResolved] = useState<any | null>(null);

  const buildPayload = (o?: Partial<typeof DEMO & { hash: string }>) => {
    const v = o?.valueEth ?? valueEth;
    const g = o?.gasUsed ?? gasUsed;
    const valWei = Math.round(parseFloat(v || "0") * 1e18);
    const gUsed = parseInt(g || "21000", 10);
    return {
      hash: o?.hash ?? hash ?? "0x" + "0".repeat(64),
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

  /**
   * Turn a pasted hash into the transaction's real on-chain values.
   *
   * Without this the hash was a label only: scoring ran on whatever from/to/
   * value/gas the form held, which in hash mode were the demo defaults -- so
   * every hash returned an identical verdict. Returns null and surfaces the
   * reason if the hash cannot be resolved, rather than silently scoring the
   * defaults under the user's hash.
   */
  const resolveHash = async (h: string) => {
    const { ok, data, error } = await apiFetch<any>(
      `/api/v1/transactions/resolve/${h.trim()}`,
    );
    if (!ok || !data?.data) {
      setErrorMsg(error || `Could not resolve ${h}.`);
      return null;
    }
    const t = data.data;
    setFromAddr(t.from_address);
    setToAddr(t.to_address ?? "");
    setValueEth(String(Number(t.value) / 1e18));
    setGasUsed(String(t.gas_used));
    setResolved(t);
    return {
      hash: t.hash,
      from_address: t.from_address,
      to_address: t.to_address ?? "0x0000000000000000000000000000000000000000",
      value: t.value,
      gas: t.gas,
      gas_used: t.gas_used,
      effective_gas_price: t.effective_gas_price,
      cumulative_gas_used: t.cumulative_gas_used,
      nonce: t.nonce,
      input_data: t.input_data,
    };
  };

  /**
   * Re-score the transaction currently on screen through one named model.
   *
   * The chips used to be a viewer -- they re-displayed a probability already in
   * the response. Selecting a model now sends model_id, so the verdict, the
   * recommended action and the SHAP attribution all reflect that model rather
   * than the ensemble.
   */
  const selectModel = async (id: string) => {
    setViewModel(id);
    setSelectedModel(id);
    if (!result) return;
    const base = resolved ?? buildPayload();
    await run({ ...base, model_id: id === "consensus" ? null : id.replace(/-/g, "_") }, id);
  };

  const run = async (payload?: Record<string, unknown>, asModel = selectedModel) => {
    setResult(null);
    setErrorMsg(null);
    // Only cleared for a fresh run. A model re-score reuses the resolved
    // payload, so wiping it here would drop back to the form values.
    if (!payload) setResolved(null);

    // Hash mode resolves against chain first. If that fails we stop rather than
    // quietly scoring the form defaults under the user's hash.
    if (!payload) {
      if (mode === "hash") {
        if (!hash.trim()) {
          setErrorMsg("Paste a transaction hash first.");
          return;
        }
        setStage(0);
        const r = await resolveHash(hash);
        if (!r) {
          setStage(-1);
          return;
        }
        payload = {
          ...r,
          model_id: asModel === "consensus" ? null : asModel.replace(/-/g, "_"),
        };
      } else {
        payload = {
          ...buildPayload(),
          model_id: asModel === "consensus" ? null : asModel.replace(/-/g, "_"),
        };
      }
    } else if (!("model_id" in payload)) {
      payload = {
        ...payload,
        model_id: asModel === "consensus" ? null : asModel.replace(/-/g, "_"),
      };
    }
    setStage(0);
    const startTime = performance.now();

    // Advance through the "in-flight" stages on a timer -- purely a "this is
    // probably happening now" indicator. None of these render as complete
    // (green) while showing; only setStage(STAGES.length) below, gated on a
    // real successful response, does that.
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
        // The backend sends `feature_signals`, not `shap_waterfall` -- the latter
        // key exists nowhere in the response, so this always fell back to [] and
        // the attribution panel rendered its empty state on every run. Each entry
        // is {feature, label, value, signal_value, direction}.
        // Real Shapley values when the backend could compute them (exact, tree
        // and linear models), otherwise the heuristic importance table. The two
        // are different quantities, so the panel is told which it is showing
        // rather than presenting a fixed weight table as SHAP.
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

  const runDemo = () => {
    setMode("manual");
    setHash("");
    setFromAddr(DEMO.fromAddr);
    setToAddr(DEMO.toAddr);
    setValueEth(DEMO.valueEth);
    setGasUsed(DEMO.gasUsed);
    run(
      {
        ...buildPayload({ ...DEMO, hash: "" }),
        model_id: selectedModel === "consensus" ? null : selectedModel.replace(/-/g, "_"),
      },
      selectedModel,
    );
  };

  const busy = stage >= 0;

  return (
    <ModuleShell>
      <PageHeader
        eyebrow="Fraud detection"
        title="Interrogate any transaction."
        description="Paste a hash and Aegis retrieves the on-chain payload itself, or enter engineered features directly. Every verdict ships with model consensus, feature attribution and a recommended action."
      />

      {prefilled ? (
        <div className="mb-4 rounded-full glass-soft px-4 py-2 text-xs text-muted-foreground">
          Prefilled from a history entry — review the fields below and run detection.
        </div>
      ) : null}

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
              <p className="mt-3 text-[11px] text-muted-foreground">
                Fetched from Ethereum mainnet, then scored on its real from/to/value/gas and the
                sending wallet's token history.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-[11px] text-muted-foreground">From Address</label>
                <input
                  value={fromAddr}
                  onChange={(e) => setFromAddr(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/4 px-3 py-2.5 font-mono text-xs outline-none transition focus:border-cyan/40"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">To Address / Contract</label>
                <input
                  value={toAddr}
                  onChange={(e) => setToAddr(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/4 px-3 py-2.5 font-mono text-xs outline-none transition focus:border-cyan/40"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Transfer Value (ETH)</label>
                <input
                  value={valueEth}
                  onChange={(e) => setValueEth(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/4 px-3 py-2.5 font-mono text-xs outline-none transition focus:border-cyan/40"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Gas Used</label>
                <input
                  value={gasUsed}
                  onChange={(e) => setGasUsed(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/4 px-3 py-2.5 font-mono text-xs outline-none transition focus:border-cyan/40"
                />
              </div>
            </div>
          )}

          {/* Target Model Selector */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                <Cpu className="h-3.5 w-3.5 text-cyan-accent" />
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
                    ? "border-cyan/50 bg-cyan/10 text-foreground shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                    : "border-white/5 bg-white/3 text-muted-foreground hover:border-white/15 hover:bg-white/6 hover:text-foreground",
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Consensus</span>
                  {selectedModel === "consensus" && (
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan animate-pulse shrink-0" />
                  )}
                </div>
                <span className="mt-1 text-[10px] text-muted-foreground leading-tight">
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
                      ? "border-cyan/50 bg-cyan/10 text-foreground shadow-[0_0_12px_rgba(6,182,212,0.15)]"
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
                  <span className="mt-1 text-[10px] text-muted-foreground leading-tight truncate w-full">
                    {m.family}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-7 flex gap-2">
            <button
              onClick={() => run()}
              disabled={busy}
              className="grad-fill sheen inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-medium disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {busy ? "Analysing…" : "Run detection"}
            </button>
            <button
              onClick={runDemo}
              disabled={busy}
              title="Fill a real sample transaction and analyse it immediately"
              className="inline-flex items-center justify-center gap-2 rounded-2xl glass-soft px-5 py-3.5 text-sm font-medium transition hover:bg-white/8 disabled:opacity-50"
            >
              <PlayCircle className="h-4 w-4" /> Try demo
            </button>
          </div>

          <AnimatePresence>
            {busy ? (
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
        </Panel>

        <div className="space-y-4">
          {result ? (
            <>
              {result.featuresDefaulted ? (
                <div className="flex items-center gap-2 rounded-full border border-warn/35 bg-warn/12 px-4 py-2 text-xs text-warn">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Scored on gas/value features — token data unavailable.
                </div>
              ) : null}
              <VerdictHero result={result} viewModel={viewModel} onSelectModel={selectModel} />
            </>
          ) : errorMsg ? (
            <Panel delay={0.1} className="border-risk/40 bg-risk/5 p-6 text-center">
              <h2 className="text-sm font-semibold text-risk">Analysis Error</h2>
              <p className="mt-3 font-mono text-xs text-muted-foreground">{errorMsg}</p>
            </Panel>
          ) : (
            <Panel delay={0.1} className="grid min-h-[320px] place-items-center text-center">
              <div className="max-w-xs">
                <div className="mx-auto h-12 w-12 rounded-full glass-soft" />
                <p className="mt-5 text-sm text-muted-foreground">
                  Verdict, model consensus, feature attribution, transaction evidence and a
                  recommended action all materialise here once you run detection.
                </p>
              </div>
            </Panel>
          )}
        </div>
      </div>

      {result ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
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

function VerdictHero({
  result,
  viewModel,
  onSelectModel,
}: {
  result: Result;
  viewModel: string;
  onSelectModel: (id: string) => void;
}) {
  // "Consensus" is the ensemble decision computed by the backend
  // (compute_consensus); selecting a model instead re-displays that one
  // model's own probability/verdict from the same already-fetched
  // model_scores array -- no second calculation, no new request.
  const active = viewModel === "consensus" ? null : result.modelScores.find((m) => m.model_id === viewModel) ?? null;
  const displayVerdict = active ? active.verdict : result.verdict;
  const displayRisk = active ? Number((active.probability * 100).toFixed(1)) : result.risk;
  const level = levelFromVerdict(displayVerdict, displayRisk);
  const tone = level === "high" ? "text-risk" : level === "elevated" ? "text-warn" : "text-safe";
  const agreeing = active ? result.modelScores.filter((m) => m.verdict === active.verdict).length : 0;

  return (
    <Panel className="relative overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
          Verdict — {active ? active.name : "ensemble consensus"}
        </div>
        <RiskBadge level={level} />
      </div>

      {result.modelScores.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="View verdict by model">
          <button
            role="tab"
            aria-selected={viewModel === "consensus"}
            onClick={() => onSelectModel("consensus")}
            className={cn(
              "rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition",
              viewModel === "consensus" ? "bg-white/14 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/6",
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
                "rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition",
                viewModel === m.model_id ? "bg-white/14 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/6",
              )}
            >
              {m.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className={cn("mt-5 font-display text-4xl font-bold leading-none sm:text-5xl", tone)}>
        {verdictLabel(displayVerdict)}
      </div>
      <div className="mt-7 grid grid-cols-3 gap-4">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            Fraud probability
          </div>
          <div className="mt-1 font-display text-2xl font-semibold tabular-nums">
            {displayRisk}
            <span className="text-sm text-muted-foreground">/100</span>
          </div>
        </div>
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            {active ? "Models agreeing" : "Model agreement"}
          </div>
          <div className="mt-1 font-display text-2xl font-semibold tabular-nums">
            {active ? `${agreeing}/${result.modelScores.length}` : `${(result.confidence * 100).toFixed(1)}%`}
          </div>
        </div>
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            Processing time
          </div>
          <div className="mt-1 font-display text-2xl font-semibold tabular-nums">
            {result.ms}
            <span className="text-sm text-muted-foreground"> ms</span>
          </div>
        </div>
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
  return (
    <Panel delay={0.1}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Model consensus — why</h2>
        <span className="font-mono text-[11px] text-muted-foreground">
          {result.agreedModels} / {result.totalModels} models agree
        </span>
      </div>
      {total === 0 ? (
        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
          No per-model scores were returned for this transaction.
        </p>
      ) : (
        <div className="relative mx-auto mt-4 grid min-h-[340px] w-full max-w-[620px] place-items-center">
          <svg className="absolute inset-0 h-full w-full" aria-hidden>
            {scores.map((m, i) => {
              const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
              const x = 50 + Math.cos(angle) * 38;
              const y = 50 + Math.sin(angle) * 40;
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
                  top: `${50 + Math.sin(angle) * 40}%`,
                }}
              >
                <div
                  className="rounded-2xl glass-soft px-3 py-2.5"
                  style={{
                    boxShadow: selected
                      ? `0 0 0 2px var(--cyan-accent), 0 0 22px -4px var(--cyan-accent)`
                      : `0 0 0 1px ${fraud ? "var(--risk)" : "var(--safe)"}`,
                  }}
                >
                  <div className="text-[11px] font-medium">{m.name}</div>
                  <div
                    className={`mt-1 font-mono text-[10px] uppercase tracking-[0.14em] ${fraud ? "text-risk" : "text-safe"}`}
                  >
                    {fraud ? "fraud" : "clear"} · {(m.probability * 100).toFixed(0)}%
                  </div>
                </div>
              </motion.div>
            );
          })}

          <div className="relative z-10 grid h-28 w-28 place-items-center rounded-full glass-panel text-center">
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
    <Panel delay={0.16}>
      <h2 className="text-sm font-semibold">
        {real ? "SHAP attribution — why" : "Feature attribution — why"}
      </h2>
      {/* Names the method rather than leaving the reader to assume. The two are
          different quantities: exact Shapley values computed for this specific
          transaction, versus a fixed importance table whose magnitudes are the
          same on every run. */}
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        {real
          ? `Exact Shapley values for this transaction, averaged over ${models.length} tree and linear models (${models.join(", ")}). The three neural models are excluded — their explainers are approximations and too slow to run per request.`
          : "Heuristic importance table, not Shapley values — the same weights on every transaction, signed by the observed value."}
      </p>
      {shap.length > 0 ? (
        <ul className="mt-5 space-y-3.5">
          {shap.map((f) => (
            <li key={f.feature}>
              <div className="flex items-baseline justify-between text-xs">
                <span>{f.feature}</span>
                <span className="font-mono tabular-nums text-muted-foreground">
                  {f.shap_value > 0 ? "+" : ""}
                  {Number(f.shap_value).toFixed(3)}
                </span>
              </div>
              <div className="mt-2">
                <Meter value={Math.abs(f.shap_value) * 200} tone={f.shap_value > 0 ? "risk" : "safe"} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
          Feature attribution unavailable for this transaction — the backend did not return a SHAP
          waterfall for this request.
        </p>
      )}
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
    ["Hash", tx.hash, tx.hash],
    ["Block", `#${tx.block_number.toLocaleString()}`, null],
    ["Timestamp", new Date(tx.timestamp * 1000).toLocaleString(), null],
    ["From", tx.from_address, tx.from_address],
    ["To", tx.to_address ?? "Contract creation", tx.to_address],
    ["Value", `${tx.value_eth} ETH`, null],
    ["Gas used", tx.gas_used.toLocaleString(), null],
    ["Gas price", `${tx.effective_gas_price_gwei} gwei`, null],
  ];

  return (
    <Panel delay={0.22}>
      <h2 className="text-sm font-semibold">What was analyzed</h2>
      <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map(([label, value, copyValue]) => (
          <div key={label}>
            <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              {label}
            </dt>
            <dd className="mt-1 flex items-center gap-1.5 break-all font-mono text-xs">
              {value}
              {copyValue ? (
                <button
                  onClick={() => copy(copyValue, label)}
                  className="shrink-0 text-muted-foreground/60 transition hover:text-foreground"
                  aria-label={`Copy ${label}`}
                >
                  <Copy className="h-3 w-3" />
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
    <Panel delay={0.28}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Recommended action</h2>
        <div className="flex items-center gap-2">
          <RiskBadge level={level} />
          <span className="rounded-full glass-soft px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em]">
            {actionLabel(result.action)}
          </span>
        </div>
      </div>
      <div className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
        {result.recommendations.length > 0 ? (
          result.recommendations.map((rec, i) => (
            <p key={i} className="flex items-start gap-2">
              <span className="text-cyan">•</span> {rec}
            </p>
          ))
        ) : (
          <p>No recommendation text was returned for this transaction.</p>
        )}
      </div>
    </Panel>
  );
}
