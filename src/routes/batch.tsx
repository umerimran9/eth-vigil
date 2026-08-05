import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useState } from "react";
import { UploadCloud, FileSpreadsheet, Play } from "lucide-react";
import { ModuleShell, PageHeader, Panel, RiskBadge, StatTile, short } from "@/components/ui-kit";
import { levelFromRisk, randomHash } from "@/lib/platform-data";

export const Route = createFileRoute("/batch")({
  head: () => ({
    meta: [
      { title: "Batch Detection — Aegis" },
      {
        name: "description",
        content:
          "Upload a CSV of Ethereum transactions and score thousands of rows at once with per-row risk levels and exportable batch summaries.",
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
  hash: string;
  risk: number;
}

function Batch() {
  const [rows, setRows] = useState<Row[]>([]);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [file, setFile] = useState<string | null>(null);

  const start = () => {
    setRows([]);
    setProgress(0);
    setRunning(true);
    setFile(file ?? "mainnet_batch_q3.csv");
    let n = 0;
    const total = 48;
    const id = setInterval(() => {
      n += 1;
      setProgress(Math.round((n / total) * 100));
      setRows((prev) => [
        { hash: randomHash(), risk: Number((Math.random() * 100).toFixed(1)) },
        ...prev,
      ]);
      if (n >= total) {
        clearInterval(id);
        setRunning(false);
      }
    }, 90);
  };

  const flagged = rows.filter((r) => r.risk > 38).length;

  return (
    <ModuleShell>
      <PageHeader
        eyebrow="Batch detection"
        title="Thousands of transactions. One pass."
        description="Drop a CSV export from any indexer. Aegis maps columns automatically, scores every row through the primary ensemble and streams results as they complete."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          <Panel>
            <label className="group flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-white/14 bg-white/2 px-6 py-14 text-center transition hover:border-cyan/40 hover:bg-white/4">
              <UploadCloud className="h-7 w-7 text-cyan transition group-hover:-translate-y-1" strokeWidth={1.5} />
              <span className="mt-4 text-sm font-medium">Drop your CSV here</span>
              <span className="mt-1 text-xs text-muted-foreground">
                hash, from, to, value, gas, timestamp
              </span>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0]?.name ?? null)}
              />
            </label>
            {file ? (
              <div className="mt-4 flex items-center gap-2 rounded-xl glass-soft px-4 py-3 text-xs">
                <FileSpreadsheet className="h-4 w-4 text-safe" />
                <span className="font-mono">{file}</span>
              </div>
            ) : null}
            <button
              onClick={start}
              disabled={running}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-6 py-3.5 text-sm font-medium text-background transition hover:scale-[1.01] disabled:opacity-50"
            >
              <Play className="h-4 w-4" /> {running ? `Scoring ${progress}%` : "Run batch analysis"}
            </button>
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
            <StatTile label="Rows scored" value={String(rows.length)} accent="cyan" />
            <StatTile label="Flagged" value={String(flagged)} accent="risk" delay={0.05} />
          </div>
        </div>

        <Panel delay={0.1} className="p-0">
          <div className="border-b border-white/8 px-6 py-4 text-sm font-semibold">Batch results</div>
          <div className="max-h-[560px] overflow-y-auto">
            {rows.length === 0 ? (
              <p className="px-6 py-16 text-center text-xs text-muted-foreground">
                Results stream in row by row as the ensemble completes each prediction.
              </p>
            ) : (
              rows.map((r) => (
                <motion.div
                  key={r.hash}
                  layout
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-4 border-b border-white/5 px-6 py-3"
                >
                  <span className="font-mono text-[11px]">{short(r.hash)}</span>
                  <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">
                    {r.risk.toFixed(1)}
                  </span>
                  <RiskBadge level={levelFromRisk(r.risk)} />
                </motion.div>
              ))
            )}
          </div>
        </Panel>
      </div>
    </ModuleShell>
  );
}
