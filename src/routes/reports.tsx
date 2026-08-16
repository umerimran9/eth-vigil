import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, FileJson, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { ModuleShell, PageHeader, Panel, StatTile } from "@/components/ui-kit";
import { levelFromVerdict } from "@/lib/platform-data";
import { API_BASE_URL, apiFetch } from "@/lib/api";
import { downloadCsv, downloadJson } from "@/lib/export";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Aegis" },
      {
        name: "description",
        content: "Export the current session's analysis history from the Aegis platform as CSV or JSON.",
      },
      { property: "og:title", content: "Reports — Aegis" },
      {
        property: "og:description",
        content: "A real export of every analysis run in this session — no templates, no fabricated numbers.",
      },
    ],
  }),
  component: Reports,
});

interface HistoryRecord {
  id: string;
  hash: string;
  from_address: string;
  to_address: string;
  value_eth: number;
  risk: number;
  verdict: string;
  confidence: number;
  model: string;
  mode: string;
  at: string;
}

function Reports() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<any>("/api/v1/history")
      .then(({ ok, data, error }) => {
        if (ok && data?.history) setRecords(data.history);
        else setLoadError(error);
      })
      .finally(() => setLoaded(true));
  }, []);

  const flagged = records.filter((r) => levelFromVerdict(r.verdict, r.risk) !== "safe").length;

  const exportCsv = () => {
    downloadCsv(
      `aegis_session_report_${Date.now()}.csv`,
      ["id", "hash", "model", "mode", "risk", "verdict", "confidence", "from_address", "to_address", "value_eth", "at"],
      records.map((r) => [r.id, r.hash, r.model, r.mode, r.risk, r.verdict, r.confidence, r.from_address, r.to_address, r.value_eth, r.at]),
    );
    toast.success(`Exported ${records.length} records`);
  };

  const exportJson = () => {
    downloadJson(`aegis_session_report_${Date.now()}.json`, records);
    toast.success(`Exported ${records.length} records`);
  };

  return (
    <ModuleShell>
      <PageHeader
        eyebrow="Reports"
        title="This session, exported."
        description="A real export of every analysis run against this backend since it started — sourced directly from /api/v1/history, not a template. Restarting the backend clears it."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Records this session" value={String(records.length)} accent="cyan" />
        <StatTile label="Flagged (elevated/high)" value={String(flagged)} accent="risk" delay={0.05} />
        <StatTile
          label="Legitimate"
          value={String(records.length - flagged)}
          accent="safe"
          delay={0.1}
        />
      </div>

      <Panel delay={0.16} className="mt-4">
        <h2 className="text-sm font-semibold">Export</h2>
        {loaded && records.length === 0 ? (
          <p className="mt-4 text-xs text-muted-foreground">
            {loadError ?? "No analyses have been run yet — export becomes available once you run a detection or batch job."}
          </p>
        ) : (
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Downloads every record currently held in the backend's in-memory history ledger.
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={exportCsv}
            disabled={records.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-xs font-medium text-background transition hover:scale-[1.02] disabled:opacity-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Export CSV
          </button>
          <button
            onClick={exportJson}
            disabled={records.length === 0}
            className="inline-flex items-center gap-2 rounded-xl glass-soft px-5 py-2.5 text-xs font-medium transition hover:bg-white/10 disabled:opacity-50"
          >
            <FileJson className="h-3.5 w-3.5" /> Export JSON
          </button>
          <a
            href={`${API_BASE_URL}/api/v1/history`}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <Download className="h-3 w-3" /> view raw API response
          </a>
        </div>
      </Panel>
    </ModuleShell>
  );
}
