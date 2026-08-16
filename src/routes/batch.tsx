import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useState } from "react";
import { UploadCloud, FileSpreadsheet, Play, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ModuleShell, PageHeader, Panel, RiskBadge, StatTile } from "@/components/ui-kit";
import { levelFromVerdict, MODELS } from "@/lib/platform-data";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/batch")({
  head: () => ({
    meta: [
      { title: "Batch Detection — Aegis" },
      {
        name: "description",
        content:
          "Upload a CSV of Ethereum transactions and score every row through the primary ensemble with real per-row verdicts and an exportable batch summary.",
      },
      { property: "og:title", content: "Batch Detection — Aegis" },
      {
        property: "og:description",
        content: "CSV batch scoring for Ethereum transactions with per-row explainable risk output.",
      },
    ],
  }),
  component: Batch,
});

interface Row {
  rowIndex: number;
  risk: number;
  verdict: string;
}

interface BatchSummary {
  total_rows: number;
  flagged_fraud_count: number;
  legitimate_count: number;
  average_risk_score: number;
}

const DEMO_CSV_URL = "/demo/demo_batch_sample.csv";

function Batch() {
  // Which model scores the batch. "consensus" keeps the ensemble mean.
  const [batchModel, setBatchModel] = useState<string>("consensus");
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<BatchSummary | null>(null);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [file, setFile] = useState<string | null>(null);
  const [fileObject, setFileObject] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const start = async () => {
    if (!fileObject) return;
    setRows([]);
    setSummary(null);
    setErrorMsg(null);
    setProgress(25);
    setRunning(true);

    const formData = new FormData();
    formData.append("file", fileObject);
    const { ok, data, error } = await apiFetch<any>(
      `/api/v1/batch/upload${batchModel === "consensus" ? "" : `?model_id=${batchModel.replace(/-/g, "_")}`}`, {
      method: "POST",
      body: formData,
    });
    setProgress(100);

    if (ok && data?.row_scores) {
      setRows(
        data.row_scores.map((r: any) => ({
          rowIndex: r.row_index,
          risk: Number((r.risk_score * 100).toFixed(1)),
          verdict: r.verdict,
        })),
      );
      setSummary(data.batch_summary ?? null);
    } else {
      setErrorMsg(error || "The backend returned an unexpected response shape.");
    }
    setRunning(false);
  };

  const loadDemo = async () => {
    try {
      const res = await fetch(DEMO_CSV_URL);
      if (!res.ok) throw new Error(`${res.status}`);
      const blob = await res.blob();
      const f = new File([blob], "demo_batch_sample.csv", { type: "text/csv" });
      setFileObject(f);
      setFile(f.name);
    } catch {
      toast.error("Could not load the bundled demo CSV.");
    }
  };

  const scored = summary?.total_rows ?? rows.length;
  const flagged = summary?.flagged_fraud_count ?? rows.filter((r) => levelFromVerdict(r.verdict) !== "safe").length;
  const truncated = summary ? summary.total_rows > rows.length : false;

  return (
    <ModuleShell>
      <PageHeader
        eyebrow="Batch detection"
        title="Thousands of transactions. One pass."
        description="Drop a CSV export from any indexer, or load the bundled held-out sample. Aegis scores every row through the primary ensemble with real per-row verdicts."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          <Panel>
            <label className="group flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-white/14 bg-white/2 px-6 py-14 text-center transition hover:border-cyan/40 hover:bg-white/4">
              <UploadCloud className="h-7 w-7 text-cyan transition group-hover:-translate-y-1" strokeWidth={1.5} />
              <span className="mt-4 text-sm font-medium">Drop your CSV here</span>
              <span className="mt-1 text-xs text-muted-foreground">
                a raw-transaction CSV, or a pre-engineered 61-feature matrix
              </span>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFileObject(f);
                  setFile(f?.name ?? null);
                }}
              />
            </label>
            {file ? (
              <div className="mt-4 flex items-center gap-2 rounded-xl glass-soft px-4 py-3 text-xs">
                <FileSpreadsheet className="h-4 w-4 text-safe" />
                <span className="font-mono">{file}</span>
              </div>
            ) : null}

            {/* Which model scores the batch. Consensus averages the ensemble;
                picking one sends model_id so every row is scored through that
                model alone, at its own tuned threshold. */}
            <div className="mt-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                Scoring model
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["consensus", ...MODELS.map((m) => m.id)].map((id) => {
                  const label =
                    id === "consensus" ? "Consensus" : (MODELS.find((m) => m.id === id)?.name ?? id);
                  const on = batchModel === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setBatchModel(id)}
                      aria-pressed={on}
                      className={cn(
                        "rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em]",
                        on
                          ? "bg-white/14 text-foreground"
                          : "text-muted-foreground hover:bg-white/6 hover:text-foreground",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={start}
                disabled={running || !fileObject}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-foreground px-6 py-3.5 text-sm font-medium text-background transition hover:scale-[1.01] disabled:opacity-50"
              >
                <Play className="h-4 w-4" /> {running ? `Scoring ${progress}%` : "Run batch analysis"}
              </button>
              <button
                onClick={loadDemo}
                disabled={running}
                title="Load a real 3,000-row held-out sample (8.6% fraud rate)"
                className="inline-flex items-center justify-center gap-2 rounded-2xl glass-soft px-5 py-3.5 text-sm font-medium transition hover:bg-white/8 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" /> Load demo CSV
              </button>
            </div>
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/8">
              <motion.div
                animate={{ width: `${progress}%` }}
                transition={{ ease: "linear", duration: 0.1 }}
                className="h-full rounded-full"
                style={{ background: "var(--gradient-core)" }}
              />
            </div>
          </Panel>

          <div className="grid gap-4 sm:grid-cols-2">
            <StatTile label="Rows scored" value={String(scored)} accent="cyan" />
            <StatTile label="Flagged" value={String(flagged)} accent="risk" delay={0.05} />
          </div>
        </div>

        <Panel delay={0.1} className="p-0">
          <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
            <span className="text-sm font-semibold">Batch results</span>
            {truncated ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                showing first {rows.length} of {summary!.total_rows}
              </span>
            ) : null}
          </div>
          <div className="max-h-[560px] overflow-y-auto">
            {errorMsg ? (
              <p className="px-6 py-16 text-center text-xs text-risk">{errorMsg}</p>
            ) : rows.length === 0 ? (
              <p className="px-6 py-16 text-center text-xs text-muted-foreground">
                Results appear here once a batch finishes scoring.
              </p>
            ) : (
              rows.map((r) => (
                <motion.div
                  key={r.rowIndex}
                  layout
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-4 border-b border-white/5 px-6 py-3"
                >
                  <span className="font-mono text-[11px] text-muted-foreground">
                    row #{r.rowIndex}
                  </span>
                  <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">
                    {r.risk.toFixed(1)}
                  </span>
                  <RiskBadge level={levelFromVerdict(r.verdict)} />
                </motion.div>
              ))
            )}
          </div>
        </Panel>
      </div>
    </ModuleShell>
  );
}
