import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useMemo, useState, useEffect } from "react";
import { Download, RotateCw, Search } from "lucide-react";
import { ModuleShell, PageHeader, Panel, RiskBadge, short } from "@/components/ui-kit";
import { levelFromVerdict, type RiskLevel } from "@/lib/platform-data";
import { apiFetch } from "@/lib/api";
import { downloadCsv } from "@/lib/export";

interface HistoryRow {
  id: string;
  hash: string;
  model: string;
  risk: number;
  level: RiskLevel;
  confidence: number;
  mode: string;
  at: string;
  fromAddress: string;
  toAddress: string;
  valueEth: number;
  verdict: string;
}

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Analysis History — Aegis" },
      {
        name: "description",
        content:
          "Search, filter, export and re-run every previous Ethereum fraud analysis performed on the Aegis platform.",
      },
      { property: "og:title", content: "Analysis History — Aegis" },
      {
        property: "og:description",
        content: "A searchable ledger of every prediction, with one-click re-runs and CSV export.",
      },
    ],
  }),
  component: History,
});

const FILTERS = ["all", "safe", "elevated", "high"] as const;

function History() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [dataRows, setDataRows] = useState<HistoryRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<any>("/api/v1/history")
      .then(({ ok, data, error }) => {
        if (ok && data?.history) {
          const apiRows: HistoryRow[] = data.history.map((h: any) => ({
            id: h.id,
            hash: h.hash,
            model: h.model,
            risk: h.risk,
            level: levelFromVerdict(h.verdict, h.risk),
            confidence: h.confidence,
            mode: h.mode,
            at: h.at,
            fromAddress: h.from_address ?? "",
            toAddress: h.to_address ?? "",
            valueEth: h.value_eth ?? 0,
            verdict: h.verdict ?? "",
          }));
          setDataRows(apiRows);
        } else {
          setLoadError(error);
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  const rows = useMemo(
    () =>
      dataRows.filter(
        (h) =>
          (filter === "all" || h.level === filter) &&
          (query === "" ||
            h.hash.includes(query.toLowerCase()) ||
            h.model.toLowerCase().includes(query.toLowerCase()) ||
            h.id.toLowerCase().includes(query.toLowerCase())),
      ),
    [dataRows, query, filter],
  );

  const exportCsv = () => {
    downloadCsv(
      `aegis_history_${Date.now()}.csv`,
      ["id", "hash", "model", "mode", "risk", "verdict", "confidence", "from_address", "to_address", "value_eth", "at"],
      rows.map((h) => [h.id, h.hash, h.model, h.mode, h.risk, h.verdict, h.confidence, h.fromAddress, h.toAddress, h.valueEth, h.at]),
    );
  };

  return (
    <ModuleShell>
      <PageHeader
        eyebrow="History"
        title="Every verdict, retrievable."
        description="A complete ledger of past analyses with the model used, resulting risk, confidence and mode. Re-run any entry against the current ensemble in one click."
        aside={
          <button
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-2 rounded-full glass-soft px-5 py-2.5 text-sm transition hover:bg-white/8 disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        }
      />

      <Panel className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-white/8 px-6 py-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search hash, model or analysis id…"
            className="min-w-40 flex-1 bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground/70"
          />
          <div className="flex rounded-full glass-soft p-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="relative rounded-full px-3.5 py-1.5 text-[11px] capitalize"
              >
                {filter === f ? (
                  <motion.span
                    layoutId="history-filter"
                    className="absolute inset-0 rounded-full bg-white/10"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                ) : null}
                <span className="relative">{f}</span>
              </button>
            ))}
          </div>
        </div>

        {loaded && rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center text-muted-foreground">
            <p className="text-sm">{loadError ? "Could not load history." : "No transactions analysed yet."}</p>
            <p className="text-xs">
              {loadError ?? "Run a detection from the Fraud Detection or Batch page to populate this ledger."}
            </p>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              <tr className="border-b border-white/8">
                {["ID", "Hash", "Model", "Mode", "Risk", "Confidence", "When", ""].map((h) => (
                  <th key={h} className="px-6 py-3 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((h, i) => (
                <motion.tr
                  key={h.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-white/5 transition hover:bg-white/4"
                >
                  <td className="px-6 py-3.5 font-mono">{h.id}</td>
                  <td className="px-6 py-3.5 font-mono text-muted-foreground">{short(h.hash)}</td>
                  <td className="px-6 py-3.5">{h.model}</td>
                  <td className="px-6 py-3.5 text-muted-foreground">{h.mode}</td>
                  <td className="px-6 py-3.5">
                    <RiskBadge level={h.level} label={`${h.risk}`} />
                  </td>
                  <td className="px-6 py-3.5 font-mono tabular-nums">
                    {(h.confidence * 100).toFixed(1)}%
                  </td>
                  <td className="px-6 py-3.5 text-muted-foreground">
                    {new Date(h.at).toLocaleString()}
                  </td>
                  <td className="px-6 py-3.5">
                    <Link
                      to="/detect"
                      search={{ from: h.fromAddress, to: h.toAddress, value: String(h.valueEth), hash: h.hash }}
                      className="inline-flex items-center gap-1.5 rounded-full glass-soft px-3 py-1.5 text-[11px] transition hover:bg-white/10"
                    >
                      <RotateCw className="h-3 w-3" /> Re-run
                    </Link>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </Panel>
    </ModuleShell>
  );
}
