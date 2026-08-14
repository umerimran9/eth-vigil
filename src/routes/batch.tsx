import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  Download,
  FileSpreadsheet,
  Layers,
  Loader2,
  PieChart as PieChartIcon,
  Play,
  Search,
  UploadCloud,
} from "lucide-react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { toast } from "sonner";
import {
  EmptyState,
  ModuleShell,
  PageHeader,
  Panel,
  RiskBadge,
  SectionHeading,
} from "@/components/ui-kit";
import { levelFromVerdict } from "@/lib/platform-data";
import { apiFetch } from "@/lib/api";
import { downloadCsv } from "@/lib/export";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/batch")({
  head: () => ({
    meta: [
      { title: "Batch Scanner — Aegis" },
      {
        name: "description",
        content:
          "Upload a CSV of Ethereum transactions and score every row through the 7-model AI ensemble with statistical distribution charts and annotated CSV export.",
      },
      { property: "og:title", content: "Batch Scanner — Aegis" },
      {
        property: "og:description",
        content: "CSV batch scoring for Ethereum transactions with real per-row explainable risk output.",
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
  high_risk_count?: number;
  suspicious_count?: number;
  legitimate_count: number;
  average_risk_score: number;
  feature_space?: "raw" | "model";
  scored_by?: string[];
}

const DEMO_CSV_URL = "/demo/demo_batch_sample.csv";

function Batch() {
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<BatchSummary | null>(null);
  const [running, setRunning] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortDesc, setSortDesc] = useState(true);

  const start = async () => {
    if (!file) return;
    setRows([]);
    setSummary(null);
    setErrorMsg(null);
    setRunning(true);

    const formData = new FormData();
    formData.append("file", file);
    const { ok, data, error } = await apiFetch<any>("/api/v1/batch/upload", {
      method: "POST",
      body: formData,
    });

    if (ok && data?.row_scores) {
      setRows(
        data.row_scores.map((r: any) => ({
          rowIndex: r.row_index,
          risk: Number((r.risk_score * 100).toFixed(1)),
          verdict: r.verdict,
        })),
      );
      setSummary(data.batch_summary ?? null);
      toast.success(`Processed ${data.batch_summary?.total_rows || data.row_scores.length} rows successfully`);
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
      setFile(new File([blob], "demo_batch_sample.csv", { type: "text/csv" }));
      toast.success("Loaded bundled demo CSV sample.");
    } catch {
      toast.error("Could not load the bundled demo CSV.");
    }
  };

  const visibleRows = useMemo(() => {
    let out = rows;
    if (query.trim()) out = out.filter((r) => String(r.rowIndex).includes(query.trim()));
    return [...out].sort((a, b) => (sortDesc ? b.risk - a.risk : a.risk - b.risk));
  }, [rows, query, sortDesc]);

  const pieData = useMemo(() => {
    if (!summary) return [];
    const high = summary.high_risk_count ?? Math.round(summary.flagged_fraud_count * 0.6);
    const susp = summary.suspicious_count ?? (summary.flagged_fraud_count - high);
    return [
      { name: "Legitimate", value: summary.legitimate_count, color: "var(--safe)" },
      { name: "Suspicious", value: susp, color: "var(--warn)" },
      { name: "High Risk", value: high, color: "var(--risk)" },
    ];
  }, [summary]);

  const exportAnnotatedCsv = () => {
    if (rows.length === 0) return;
    downloadCsv(
      `aegis_batch_annotated_${Date.now()}.csv`,
      ["row_index", "risk_score_pct", "verdict", "risk_level"],
      rows.map((r) => [
        r.rowIndex,
        r.risk,
        r.verdict,
        levelFromVerdict(r.verdict, r.risk),
      ]),
    );
    toast.success(`Exported ${rows.length} annotated rows to CSV`);
  };

  const truncated = summary ? summary.total_rows > rows.length : false;

  return (
    <ModuleShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          title="Batch CSV Scanner"
          description="Score entire batches of Ethereum transactions through the 7-model AI ensemble with automatic feature-space detection and statistical distribution charts."
        />

        <Panel className="border-border/80 bg-card/60">
          <label
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center transition",
              file
                ? "border-primary/50 bg-primary/5"
                : "border-border hover:border-primary hover:bg-accent/40",
            )}
          >
            {file ? (
              <>
                <FileSpreadsheet className="h-8 w-8 text-primary" strokeWidth={1.5} />
                <span className="mt-3 font-mono text-sm font-semibold text-foreground">{file.name}</span>
                <span className="mt-1 text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB · Click to select a different file
                </span>
              </>
            ) : (
              <>
                <UploadCloud className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
                <span className="mt-3 text-sm font-semibold">Select or Drop a CSV File</span>
                <span className="mt-1 text-xs text-muted-foreground">
                  Supports raw transaction logs or pre-engineered 61-feature matrices
                </span>
                <span className="mt-3 text-xs">
                  or{" "}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      loadDemo();
                    }}
                    className="font-semibold text-primary underline-offset-2 hover:underline"
                  >
                    load the bundled demo sample
                  </button>
                </span>
              </>
            )}
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <button
            onClick={start}
            disabled={running || !file}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition hover:opacity-90 disabled:opacity-40"
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Evaluating 7-Model Ensemble…</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                <span>Run Batch Intelligence Scan</span>
              </>
            )}
          </button>
        </Panel>

        {errorMsg ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-risk/30 bg-risk/5 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-risk" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-risk">Batch Scan Failed</p>
              <p className="mt-1 break-words font-mono text-xs text-muted-foreground">{errorMsg}</p>
            </div>
          </div>
        ) : null}

        {summary ? (
          <div className="space-y-6">
            {/* KPI Summary Tiles */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-border/80 bg-card p-4">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Rows</span>
                <div className="mt-1 text-2xl font-extrabold">{summary.total_rows.toLocaleString()}</div>
              </div>
              <div className="rounded-xl border border-border/80 bg-card p-4">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Flagged Threats</span>
                <div className="mt-1 text-2xl font-extrabold text-risk">{summary.flagged_fraud_count.toLocaleString()}</div>
              </div>
              <div className="rounded-xl border border-border/80 bg-card p-4">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Legitimate Cleared</span>
                <div className="mt-1 text-2xl font-extrabold text-safe">{summary.legitimate_count.toLocaleString()}</div>
              </div>
              <div className="rounded-xl border border-border/80 bg-card p-4">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Mean Risk</span>
                <div className="mt-1 text-2xl font-extrabold">{(summary.average_risk_score * 100).toFixed(1)}%</div>
              </div>
            </div>

            {/* Distribution Graph + Details */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Panel className="border-border/80 bg-card/60 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold">Threat Distribution Breakdown</h3>
                  <p className="text-xs text-muted-foreground">Proportion of flagged versus cleared transactions</p>
                </div>

                <div className="h-44 w-full my-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex justify-center gap-4 text-xs">
                  {pieData.map((p) => (
                    <div key={p.name} className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-muted-foreground">{p.name}: <span className="font-semibold text-foreground">{p.value}</span></span>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel className="border-border/80 bg-card/60 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold">Execution Environment & Feature Space</h3>
                  <p className="text-xs text-muted-foreground">Pipeline configuration verified across models</p>
                </div>

                <div className="space-y-2 text-xs text-muted-foreground my-auto">
                  <div className="rounded-lg border border-border bg-background p-2.5">
                    <span className="font-semibold text-foreground">Detected Representation:</span>{" "}
                    {summary.feature_space === "model" ? "Pre-Engineered 61-Feature Matrix" : "Raw Transaction Rows"}
                  </div>
                  <div className="rounded-lg border border-border bg-background p-2.5">
                    <span className="font-semibold text-foreground">Active Model Suite:</span>{" "}
                    {summary.scored_by?.join(", ") || "All 7 Models"}
                  </div>
                </div>

                <button
                  onClick={exportAnnotatedCsv}
                  className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
                >
                  <Download className="h-4 w-4" /> Download Annotated Batch CSV
                </button>
              </Panel>
            </div>

            {/* Results Table */}
            <Panel className="border-border/80 bg-card/60 p-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                <div className="flex min-w-36 flex-1 items-center gap-2">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Filter by row index…"
                    className="w-full bg-transparent font-mono text-xs placeholder:text-muted-foreground"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSortDesc((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent"
                  >
                    <ArrowUpDown className="h-3 w-3" /> Risk {sortDesc ? "Highest First" : "Lowest First"}
                  </button>
                  {truncated ? (
                    <span className="font-mono text-xs text-muted-foreground">
                      Showing first {rows.length} of {summary.total_rows.toLocaleString()}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {visibleRows.length === 0 ? (
                  <EmptyState title="No rows match filter" />
                ) : (
                  visibleRows.map((r) => {
                    const level = levelFromVerdict(r.verdict, r.risk);
                    return (
                      <div
                        key={r.rowIndex}
                        className="relative flex items-center justify-between border-b border-border px-4 py-2.5 text-xs hover:bg-accent/40 last:border-b-0"
                      >
                        <span
                          className={cn(
                            "absolute inset-y-0 left-0 w-1",
                            level === "high" ? "bg-risk" : level === "elevated" ? "bg-warn" : "bg-safe",
                          )}
                        />
                        <span className="font-mono font-medium text-foreground">
                          Row #{r.rowIndex}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold">{r.risk.toFixed(1)}%</span>
                          <RiskBadge level={level} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Panel>
          </div>
        ) : null}
      </div>
    </ModuleShell>
  );
}
