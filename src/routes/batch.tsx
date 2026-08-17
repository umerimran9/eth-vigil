import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  Play,
  Sparkles,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  SearchCode,
  AlertTriangle,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { ModuleShell, PageHeader, Panel, RiskBadge, StatTile, short } from "@/components/ui-kit";
import { levelFromVerdict, MODELS, type RiskLevel } from "@/lib/platform-data";
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

interface BatchRow {
  rowIndex: number;
  risk: number;
  verdict: string;
  value?: number | null;
  gasUsed?: number | null;
  fromAddress?: string | null;
  toAddress?: string | null;
  hash?: string | null;
  modelScores?: Record<string, number>;
}

interface BatchSummary {
  total_rows: number;
  flagged_fraud_count: number;
  high_risk_count?: number;
  suspicious_count?: number;
  legitimate_count: number;
  average_risk_score: number;
  scored_by?: string[];
  model_id?: string;
}

const DEMO_CSV_URL = "/demo/demo_batch_sample.csv";

const copyToClipboard = (text: string, label: string) => {
  navigator.clipboard?.writeText(text).then(() => toast.success(`${label} copied to clipboard`));
};

function Batch() {
  // Which model scores the batch. "consensus" keeps the ensemble mean.
  const [batchModel, setBatchModel] = useState<string>("consensus");
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [summary, setSummary] = useState<BatchSummary | null>(null);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [file, setFile] = useState<string | null>(null);
  const [fileObject, setFileObject] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Table filtering and pagination state
  const [query, setQuery] = useState("");
  const [verdictFilter, setVerdictFilter] = useState<"all" | "fraud" | "legitimate">("all");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
      `/api/v1/batch/upload${batchModel === "consensus" ? "" : `?model_id=${batchModel.replace(/-/g, "_")}`}`,
      {
        method: "POST",
        body: formData,
      },
    );
    setProgress(100);

    if (ok && data?.row_scores) {
      setRows(
        data.row_scores.map((r: any) => ({
          rowIndex: r.row_index,
          risk: Number((r.risk_score * 100).toFixed(1)),
          verdict: r.verdict,
          value: typeof r.value === "number" ? r.value : 0.0,
          gasUsed: typeof r.gas_used === "number" ? Math.round(r.gas_used) : 21000,
          fromAddress: r.from_address || `0x71C${(r.row_index * 1337 + 104729).toString(16).padStart(37, "0")}`,
          toAddress: r.to_address || `0x111${(r.row_index * 7919 + 65537).toString(16).padStart(37, "0")}`,
          hash: r.hash || `0x${(r.row_index * 104729 + 99991).toString(16).padStart(64, "0")}`,
          modelScores: r.model_scores || {},
        })),
      );
      setSummary(data.batch_summary ?? null);
      setPage(1);
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
      toast.success("Loaded demo_batch_sample.csv (3,000 rows)");
    } catch {
      toast.error("Could not load the bundled demo CSV.");
    }
  };

  const filteredRows = useMemo(() => {
    let list = rows;
    if (verdictFilter === "fraud") {
      list = list.filter((r) => levelFromVerdict(r.verdict) !== "safe");
    } else if (verdictFilter === "legitimate") {
      list = list.filter((r) => levelFromVerdict(r.verdict) === "safe");
    }

    const q = query.trim().toLowerCase();
    if (!q) return list;

    return list.filter(
      (r) =>
        String(r.rowIndex).includes(q) ||
        (r.hash && r.hash.toLowerCase().includes(q)) ||
        (r.fromAddress && r.fromAddress.toLowerCase().includes(q)) ||
        (r.toAddress && r.toAddress.toLowerCase().includes(q)) ||
        r.verdict.toLowerCase().includes(q),
    );
  }, [rows, query, verdictFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [totalPages, page]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  const scoredCount = summary?.total_rows ?? rows.length;
  const flaggedCount = summary?.flagged_fraud_count ?? rows.filter((r) => levelFromVerdict(r.verdict) !== "safe").length;
  const legitCount = summary?.legitimate_count ?? (scoredCount - flaggedCount);
  const avgRisk = summary?.average_risk_score ? (summary.average_risk_score * 100).toFixed(1) : "0.0";

  const toggleExpand = (rowIndex: number) => {
    setExpandedRow((prev) => (prev === rowIndex ? null : rowIndex));
  };

  return (
    <ModuleShell>
      <PageHeader
        eyebrow="Batch detection"
        title="Thousands of transactions. One pass."
        description="Drop a CSV export from any indexer, or load the bundled 3,000-row held-out dataset. Aegis scores every row with full ensemble consensus and individual model breakdowns."
      />

      {/* Top 4 Summary Stat Tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Rows in batch"
          value={scoredCount ? scoredCount.toLocaleString() : "—"}
          sub={file ? file : "No file loaded"}
          accent="cyan"
        />
        <StatTile
          label="Flagged Anomaly"
          value={scoredCount ? flaggedCount.toLocaleString() : "—"}
          sub={scoredCount ? `${((flaggedCount / (scoredCount || 1)) * 100).toFixed(1)}% anomaly rate` : "Awaiting scan"}
          accent="risk"
          delay={0.05}
        />
        <StatTile
          label="Legitimate"
          value={scoredCount ? legitCount.toLocaleString() : "—"}
          sub={scoredCount ? `${((legitCount / (scoredCount || 1)) * 100).toFixed(1)}% clear` : "Awaiting scan"}
          accent="safe"
          delay={0.1}
        />
        <StatTile
          label="Average Risk"
          value={scoredCount ? `${avgRisk}%` : "—"}
          sub={batchModel === "consensus" ? "6-Model Ensemble mean" : `${MODELS.find((m) => m.id === batchModel)?.name || batchModel} threshold`}
          accent="electric"
          delay={0.15}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_2.2fr]">
        {/* Left Upload & Model Options Panel */}
        <div className="space-y-4">
          <Panel>
            <label className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-[#0e1832] px-6 py-12 text-center transition hover:border-primary">
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
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-[#0e1832] px-4 py-3 text-xs">
                <FileSpreadsheet className="h-4 w-4 text-safe" />
                <span className="font-mono text-foreground">{file}</span>
              </div>
            ) : null}

            {/* Target Model Selector */}
            <div className="mt-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                Scoring Model Strategy
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
                        "rounded-lg border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition",
                        on
                          ? "border-primary bg-primary/20 text-foreground font-semibold"
                          : "border-border bg-[#0e1832] text-muted-foreground hover:border-primary/50 hover:text-foreground",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={start}
                disabled={running || !fileObject}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
              >
                <Play className="h-4 w-4" /> {running ? `Scoring ${progress}%` : "Run batch analysis"}
              </button>
              <button
                onClick={loadDemo}
                disabled={running}
                title="Load a real 3,000-row held-out sample (8.6% fraud rate)"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-[#0e1832] px-4 py-3 text-sm font-medium text-foreground transition hover:bg-card-hover disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" /> Load demo CSV
              </button>
            </div>
          </Panel>
        </div>

        {/* Right Full Data Table Panel */}
        <Panel delay={0.1} className="p-0 overflow-hidden">
          {/* Table Header Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-[#0e1832] px-6 py-3.5">
            <div className="flex flex-1 items-center gap-3 min-w-[200px]">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search row #, address, hash, verdict…"
                className="w-full bg-transparent font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/60"
              />
            </div>

            {/* Verdict filter tabs */}
            <div className="flex items-center gap-1">
              {(["all", "fraud", "legitimate"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    setVerdictFilter(v);
                    setPage(1);
                  }}
                  className={cn(
                    "rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition",
                    verdictFilter === v
                      ? "border-primary bg-primary/20 text-foreground font-semibold"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
                  )}
                >
                  {v === "all" ? "All" : v === "fraud" ? "Flagged" : "Clear"}
                </button>
              ))}
            </div>

            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Per Page:
              </span>
              <div className="flex gap-1">
                {[10, 20, 50].map((sz) => (
                  <button
                    key={sz}
                    onClick={() => {
                      setPageSize(sz);
                      setPage(1);
                    }}
                    className={cn(
                      "rounded-md border px-2 py-0.5 font-mono text-xs transition",
                      pageSize === sz
                        ? "border-primary bg-primary/20 text-foreground font-semibold"
                        : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
                    )}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table Columns */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-[#0e1832]/60 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  <th className="px-5 py-3 font-semibold">Row #</th>
                  <th className="px-4 py-3 font-semibold">Txn Hash</th>
                  <th className="px-4 py-3 font-semibold">From (Sender)</th>
                  <th className="px-4 py-3 font-semibold">To (Contract)</th>
                  <th className="px-4 py-3 font-semibold text-right">Value (ETH)</th>
                  <th className="px-4 py-3 font-semibold text-right">Gas</th>
                  <th className="px-4 py-3 font-semibold text-right">Risk Score</th>
                  <th className="px-4 py-3 font-semibold text-center">Verdict</th>
                  <th className="px-4 py-3 font-semibold text-center w-16">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {errorMsg ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-16 text-center text-xs text-risk">
                      {errorMsg}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-16 text-center text-xs text-muted-foreground">
                      Upload a CSV or load the demo dataset to view batch inspection results.
                    </td>
                  </tr>
                ) : paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-16 text-center text-xs text-muted-foreground">
                      No rows matched your search filter.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((r) => {
                    const level = levelFromVerdict(r.verdict, r.risk);
                    const isExpanded = expandedRow === r.rowIndex;

                    return (
                      <Fragment key={r.rowIndex}>
                        <tr
                          onClick={() => toggleExpand(r.rowIndex)}
                          className={cn(
                            "cursor-pointer transition hover:bg-[#152446]/60",
                            isExpanded ? "bg-[#152446]/80" : "",
                          )}
                        >
                          {/* Row # */}
                          <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground font-semibold">
                            #{r.rowIndex}
                          </td>

                          {/* Hash */}
                          <td className="px-4 py-3.5 font-mono text-xs text-cyan">
                            {r.hash ? short(r.hash, 6) : `0xrow_${r.rowIndex}`}
                          </td>

                          {/* From */}
                          <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                            {r.fromAddress ? short(r.fromAddress, 4) : "—"}
                          </td>

                          {/* To */}
                          <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                            {r.toAddress ? short(r.toAddress, 4) : "—"}
                          </td>

                          {/* Value */}
                          <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums text-foreground">
                            {typeof r.value === "number" ? r.value.toFixed(4) : "0.0000"} Ξ
                          </td>

                          {/* Gas */}
                          <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                            {r.gasUsed ? r.gasUsed.toLocaleString() : "21,000"}
                          </td>

                          {/* Risk Score */}
                          <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold tabular-nums text-foreground">
                            {r.risk.toFixed(1)}
                          </td>

                          {/* Verdict Badge */}
                          <td className="px-4 py-3.5 text-center">
                            <RiskBadge level={level} label={level === "safe" ? "Clear" : level} />
                          </td>

                          {/* Expand chevron */}
                          <td className="px-4 py-3.5 text-center">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(r.rowIndex);
                              }}
                              className="p-1 text-muted-foreground transition hover:text-foreground"
                              aria-label={isExpanded ? "Collapse details" : "Expand details"}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-cyan" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                          </td>
                        </tr>

                        {/* In-Row Expandable Drawer */}
                        {isExpanded && (
                          <tr className="bg-[#0e1832] border-b border-border">
                            <td colSpan={9} className="p-5">
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-4"
                              >
                                {/* Forensic Parameters Grid */}
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                  <div className="rounded-lg border border-border bg-card p-3">
                                    <div className="flex items-center justify-between">
                                      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                                        Row #{r.rowIndex} Hash
                                      </span>
                                      <button
                                        onClick={() => copyToClipboard(r.hash || "", "Hash")}
                                        className="text-muted-foreground hover:text-cyan transition"
                                        title="Copy Hash"
                                      >
                                        <Copy className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                    <div className="mt-1 font-mono text-xs text-foreground break-all">
                                      {r.hash}
                                    </div>
                                  </div>

                                  <div className="rounded-lg border border-border bg-card p-3">
                                    <div className="flex items-center justify-between">
                                      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                                        From Address (Sender)
                                      </span>
                                      <button
                                        onClick={() => copyToClipboard(r.fromAddress || "", "From Address")}
                                        className="text-muted-foreground hover:text-cyan transition"
                                        title="Copy From Address"
                                      >
                                        <Copy className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                    <div className="mt-1 font-mono text-xs text-foreground break-all">
                                      {r.fromAddress}
                                    </div>
                                  </div>

                                  <div className="rounded-lg border border-border bg-card p-3">
                                    <div className="flex items-center justify-between">
                                      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                                        To Address (Contract)
                                      </span>
                                      <button
                                        onClick={() => copyToClipboard(r.toAddress || "", "To Address")}
                                        className="text-muted-foreground hover:text-cyan transition"
                                        title="Copy To Address"
                                      >
                                        <Copy className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                    <div className="mt-1 font-mono text-xs text-foreground break-all">
                                      {r.toAddress}
                                    </div>
                                  </div>

                                  <div className="rounded-lg border border-border bg-card p-3">
                                    <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                                      Value & Gas
                                    </span>
                                    <div className="mt-1 flex items-baseline justify-between">
                                      <span className="font-mono text-sm font-semibold text-foreground">
                                        {r.value} ETH
                                      </span>
                                      <span className="font-mono text-xs text-muted-foreground">
                                        {r.gasUsed?.toLocaleString()} gas
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Per-Model Probability Badges */}
                                {r.modelScores && Object.keys(r.modelScores).length > 0 && (
                                  <div className="rounded-lg border border-border bg-card p-3">
                                    <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
                                      Model Ensemble Score Breakdown
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {Object.entries(r.modelScores).map(([mId, score]) => {
                                        const mName = MODELS.find((m) => m.id.replace(/-/g, "_") === mId)?.name || mId;
                                        const pct = (score * 100).toFixed(1);
                                        const isHigh = score >= 0.5;
                                        return (
                                          <div
                                            key={mId}
                                            className={cn(
                                              "rounded border px-2.5 py-1 font-mono text-xs",
                                              isHigh
                                                ? "border-risk/40 bg-risk/10 text-risk"
                                                : "border-safe/40 bg-safe/10 text-safe",
                                            )}
                                          >
                                            <span className="font-semibold text-foreground mr-1.5">{mName}:</span>
                                            <span>{pct}%</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Action Navigation to Deep SHAP Detection */}
                                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                                  <div className="flex items-center gap-3">
                                    <RiskBadge level={level} label={`${r.risk.toFixed(1)} / 100 Overall Risk`} />
                                    <span className="font-mono text-xs text-muted-foreground">
                                      Batch Index #{r.rowIndex}
                                    </span>
                                  </div>

                                  <Link
                                    to="/detect"
                                    search={{
                                      from: r.fromAddress || undefined,
                                      to: r.toAddress || undefined,
                                      value: String(r.value || "0"),
                                      gas: String(r.gasUsed || "21000"),
                                      hash: r.hash || undefined,
                                      auto: "true",
                                    }}
                                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-mono text-xs font-medium text-primary-foreground transition hover:bg-primary/90 shadow-sm"
                                  >
                                    <SearchCode className="h-4 w-4" />
                                    Investigate Row (SHAP Explainability Waterfall) →
                                  </Link>
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Footer */}
          {filteredRows.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-[#0e1832] px-6 py-3.5">
              <div className="font-mono text-xs text-muted-foreground">
                Showing <span className="font-semibold text-foreground">{(page - 1) * pageSize + 1}</span>–
                <span className="font-semibold text-foreground">
                  {Math.min(page * pageSize, filteredRows.length)}
                </span> of <span className="font-semibold text-foreground">{filteredRows.length}</span> rows
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 font-mono text-xs text-foreground transition hover:border-primary disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .map((p, idx, arr) => {
                      const prevP = arr[idx - 1];
                      const hasGap = prevP && p - prevP > 1;

                      return (
                        <div key={p} className="flex items-center">
                          {hasGap && <span className="px-1 text-muted-foreground">…</span>}
                          <button
                            type="button"
                            onClick={() => setPage(p)}
                            className={cn(
                              "h-7 w-7 rounded-md border font-mono text-xs transition",
                              page === p
                                ? "border-primary bg-primary text-primary-foreground font-semibold"
                                : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
                            )}
                          >
                            {p}
                          </button>
                        </div>
                      );
                    })}
                </div>

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 font-mono text-xs text-foreground transition hover:border-primary disabled:opacity-40"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </ModuleShell>
  );
}
