import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Download, GitCompare, Search } from "lucide-react";
import {
  EmptyState,
  ModuleShell,
  PageHeader,
  Panel,
  RiskBadge,
  SkeletonRows,
  short,
} from "@/components/ui-kit";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InvestigationDrawer, type DrawerRecord } from "@/components/InvestigationDrawer";
import { TransactionComparison } from "@/components/TransactionComparison";
import { levelFromVerdict, verdictLabel, type RiskLevel } from "@/lib/platform-data";
import { apiFetch } from "@/lib/api";
import { downloadCsv } from "@/lib/export";
import { cn } from "@/lib/utils";

interface CaseRow extends DrawerRecord {
  id: string;
  at: string;
  level: RiskLevel;
}

export const Route = createFileRoute("/cases")({
  head: () => ({
    meta: [
      { title: "Cases — Aegis" },
      {
        name: "description",
        content:
          "The investigation archive: every past Ethereum fraud analysis, searchable, comparable and exportable.",
      },
      { property: "og:title", content: "Cases — Aegis" },
      {
        property: "og:description",
        content: "A searchable case archive with drawer inspection, comparison and CSV export.",
      },
    ],
  }),
  component: Cases,
});

const FILTERS = ["all", "safe", "elevated", "high"] as const;
const FILTER_LABEL: Record<(typeof FILTERS)[number], string> = {
  all: "All",
  safe: "Legitimate",
  elevated: "Elevated",
  high: "High risk",
};

function Cases() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [dataRows, setDataRows] = useState<CaseRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selected, setSelected] = useState<CaseRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareA, setCompareA] = useState<CaseRow | null>(null);
  const [compareB, setCompareB] = useState<CaseRow | null>(null);

  useEffect(() => {
    apiFetch<any>("/api/v1/history")
      .then(({ ok, data, error }) => {
        if (ok && data?.history) {
          const apiRows: CaseRow[] = data.history.map((h: any) => ({
            id: h.id,
            hash: h.hash,
            at: h.at,
            verdict: h.verdict ?? "",
            action: h.action,
            risk: h.risk,
            level: levelFromVerdict(h.verdict, h.risk),
            confidence: h.confidence,
            agreedModels: h.agreed_models,
            totalModels: h.total_models,
            featureSignals: h.explainability?.feature_signals ?? [],
            modelScores: h.model_scores ?? undefined,
            transaction: h.transaction ?? {
              hash: h.hash,
              block_number: 0,
              timestamp: 0,
              from_address: h.from_address ?? "",
              to_address: h.to_address ?? null,
              value_eth: h.value_eth ?? 0,
              gas_used: 0,
              effective_gas_price_gwei: 0,
            },
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
            h.hash!.includes(query.toLowerCase()) ||
            h.id.toLowerCase().includes(query.toLowerCase())),
      ),
    [dataRows, query, filter],
  );

  const exportCsv = () => {
    downloadCsv(
      `aegis_cases_${Date.now()}.csv`,
      [
        "id",
        "hash",
        "risk",
        "verdict",
        "confidence",
        "from_address",
        "to_address",
        "value_eth",
        "at",
      ],
      rows.map((h) => [
        h.id,
        h.hash!,
        h.risk!,
        h.verdict!,
        h.confidence!,
        h.transaction?.from_address ?? "",
        h.transaction?.to_address ?? "",
        h.transaction?.value_eth ?? 0,
        h.at,
      ]),
    );
  };

  const handleRowClick = (row: CaseRow) => {
    if (compareMode) {
      if (!compareA || compareA.id === row.id) setCompareA(row);
      else setCompareB(row);
      return;
    }
    setSelected(row);
    setDrawerOpen(true);
  };

  const highCount = dataRows.filter((r) => r.level === "high").length;

  return (
    <ModuleShell>
      <PageHeader
        title="Cases"
        {...(dataRows.length > 0
          ? {
              description: `${dataRows.length} investigation${dataRows.length === 1 ? "" : "s"} this session, ${highCount} flagged high risk. Restarting the backend clears the archive.`,
            }
          : {})}
        aside={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setCompareMode((v) => !v);
                setCompareA(null);
                setCompareB(null);
              }}
              aria-pressed={compareMode}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition",
                compareMode
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border hover:bg-accent",
              )}
            >
              <GitCompare className="h-4 w-4" /> Compare
            </button>
            <button
              onClick={exportCsv}
              disabled={rows.length === 0}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition hover:bg-accent disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Export
            </button>
          </div>
        }
      />

      {compareMode ? (
        <div className="mb-3">
          <TransactionComparison
            a={compareA}
            b={compareB}
            onClear={() => {
              setCompareA(null);
              setCompareB(null);
            }}
          />
        </div>
      ) : null}

      <Panel className="p-0">
        {/* Search and filter on one compact row. The filter used to be a pill
            group styled like navigation, which read as more important than the
            data it was filtering. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-2.5">
          <div className="flex min-w-48 flex-1 items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search hash or case id…"
              aria-label="Search cases"
              className="w-full bg-transparent font-mono text-xs placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex items-center gap-0.5 rounded-md bg-muted p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={cn(
                  "rounded px-2.5 py-1 text-xs transition",
                  filter === f
                    ? "bg-card font-medium shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {FILTER_LABEL[f]}
              </button>
            ))}
          </div>
          {loaded ? (
            <span className="text-xs tabular-nums text-muted-foreground">{rows.length} shown</span>
          ) : null}
        </div>

        {!loaded ? (
          <SkeletonRows rows={5} className="p-4" />
        ) : rows.length === 0 ? (
          <EmptyState
            title={
              loadError
                ? "Could not load cases"
                : dataRows.length === 0
                  ? "No cases yet"
                  : "Nothing matches"
            }
            body={
              loadError ??
              (dataRows.length === 0
                ? "Every investigation you run is archived here automatically."
                : "Try a different search or filter.")
            }
            action={
              dataRows.length === 0 && !loadError ? (
                <Link
                  to="/detect"
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                >
                  Start an investigation
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[680px] text-xs">
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  {["Case", "Hash", "Verdict", "Risk", "Agreement", "When"].map((h) => (
                    <TableHead
                      key={h}
                      className={cn(
                        "h-auto px-4 py-2 text-xs font-medium text-muted-foreground",
                        (h === "Risk" || h === "Agreement") && "text-right",
                      )}
                    >
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((h) => (
                  <TableRow
                    key={h.id}
                    onClick={() => handleRowClick(h)}
                    className="relative cursor-pointer border-border"
                    data-state={
                      compareMode && (compareA?.id === h.id || compareB?.id === h.id)
                        ? "selected"
                        : undefined
                    }
                  >
                    <TableCell className="relative px-4 py-2.5 font-mono">
                      <span
                        className={cn(
                          "absolute inset-y-0 left-0 w-[3px]",
                          h.level === "high"
                            ? "bg-risk"
                            : h.level === "elevated"
                              ? "bg-warn"
                              : "bg-safe",
                        )}
                      />
                      {h.id}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 font-mono text-muted-foreground">
                      {short(h.hash!)}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <RiskBadge level={h.level} label={verdictLabel(h.verdict!)} />
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right font-mono tabular-nums">
                      {h.risk}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right font-mono tabular-nums text-muted-foreground">
                      {(h.confidence! * 100).toFixed(0)}%
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-muted-foreground">
                      {new Date(h.at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <InvestigationDrawer open={drawerOpen} onOpenChange={setDrawerOpen} record={selected} />
    </ModuleShell>
  );
}
