import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ModuleShell, PageHeader, Panel, RiskBadge, StatTile, short } from "@/components/ui-kit";
import { levelFromVerdict, verdictLabel, type RiskLevel } from "@/lib/platform-data";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Aegis" },
      {
        name: "description",
        content:
          "Verdict distribution, risk concentration and model agreement computed from this backend session's real analysis history.",
      },
      { property: "og:title", content: "Analytics — Aegis" },
      {
        property: "og:description",
        content: "Detection statistics computed from real scored transactions.",
      },
    ],
  }),
  component: Analytics,
});

const axis = { stroke: "oklch(0.66 0.024 264)", fontSize: 10, fontFamily: "var(--font-mono)" };
const tooltipStyle = {
  background: "oklch(0.17 0.02 268)",
  border: "1px solid oklch(0.99 0.01 265 / 12%)",
  borderRadius: 12,
  fontSize: 11,
};

interface Row {
  id: string;
  hash: string;
  risk: number;
  verdict: string;
  level: RiskLevel;
  confidence: number;
  at: string;
}

/**
 * Every figure on this page is computed from GET /api/v1/history -- the real
 * transactions this backend has scored since it started.
 *
 * It previously rendered four charts built from hand-written constants
 * (FRAUD_TREND, MODEL_USAGE, TIMELINE) plus stat tiles reading "Avg. latency
 * 2.6 ms" and a 91.4 / 6.2 / 2.4 detection split that existed nowhere in the
 * project. Those are gone rather than relabelled: a chart of invented data is
 * worse than no chart, because it looks like evidence.
 *
 * The dataset-level figures that ARE real (1,026,867 transactions, 8.65% base
 * rate) are kept, labelled as corpus facts rather than session activity.
 */
function Analytics() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    apiFetch<any>("/api/v1/history")
      .then(({ ok, data }) => {
        if (ok && Array.isArray(data?.history)) {
          setRows(
            data.history.map((h: any) => ({
              id: h.id,
              hash: h.hash,
              risk: h.risk,
              verdict: h.verdict ?? "",
              level: levelFromVerdict(h.verdict, h.risk),
              confidence: h.confidence ?? 0,
              at: h.at,
            })),
          );
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  const verdictDist = useMemo(() => {
    const c: Record<RiskLevel, number> = { safe: 0, elevated: 0, high: 0 };
    rows.forEach((r) => c[r.level]++);
    return [
      { name: "Legitimate", value: c.safe, color: "var(--safe)" },
      { name: "Elevated", value: c.elevated, color: "var(--warn)" },
      { name: "High risk", value: c.high, color: "var(--risk)" },
    ];
  }, [rows]);

  const riskHistogram = useMemo(() => {
    const b = [0, 0, 0, 0, 0];
    rows.forEach((r) => b[Math.min(4, Math.floor(r.risk / 20))]!++);
    return b.map((count, i) => ({ range: `${i * 20}–${i * 20 + 20}`, count }));
  }, [rows]);

  const agreementHistogram = useMemo(() => {
    const b = [0, 0, 0, 0, 0];
    rows.forEach((r) => b[Math.min(4, Math.floor((r.confidence * 100) / 20))]!++);
    return b.map((count, i) => ({ range: `${i * 20}–${i * 20 + 20}%`, count }));
  }, [rows]);

  const highRisk = rows.filter((r) => r.level === "high").length;
  const avgRisk = rows.length ? rows.reduce((s, r) => s + r.risk, 0) / rows.length : 0;
  const avgAgreement = rows.length
    ? (rows.reduce((s, r) => s + r.confidence, 0) / rows.length) * 100
    : 0;

  if (loaded && rows.length === 0) {
    return (
      <ModuleShell>
        <PageHeader
          eyebrow="Analytics"
          title="Nothing scored yet."
          description="This page computes its statistics from transactions this backend has actually scored. Run an investigation or a batch job and the charts fill in."
        />
        <Panel>
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No analyses in this session's history.
            </p>
            <Link
              to="/detect"
              className="grad-fill sheen rounded-full px-5 py-2.5 text-xs font-medium"
            >
              Start an investigation
            </Link>
          </div>
        </Panel>
      </ModuleShell>
    );
  }

  return (
    <ModuleShell>
      <PageHeader
        eyebrow="Analytics"
        title="Patterns, not paperwork."
        description="Computed from this backend session's real scored transactions. Restarting the backend clears the history."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Analyses" value={String(rows.length)} sub="this session" accent="cyan" />
        <StatTile
          label="High risk"
          value={String(highRisk)}
          sub="flagged fraud"
          accent="risk"
          delay={0.05}
        />
        <StatTile
          label="Avg. risk"
          value={rows.length ? avgRisk.toFixed(1) : "—"}
          sub="0–100 scale"
          accent="violet"
          delay={0.1}
        />
        <StatTile
          label="Avg. agreement"
          value={rows.length ? `${avgAgreement.toFixed(0)}%` : "—"}
          sub="model consensus"
          accent="safe"
          delay={0.15}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel delay={0.1}>
          <h2 className="text-sm font-semibold">Verdict distribution</h2>
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={verdictDist}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={62}
                  outerRadius={98}
                  paddingAngle={4}
                  stroke="none"
                >
                  {verdictDist.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel delay={0.15}>
          <h2 className="text-sm font-semibold">Risk score distribution</h2>
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskHistogram}>
                <CartesianGrid stroke="oklch(0.99 0.01 265 / 7%)" vertical={false} />
                <XAxis dataKey="range" {...axis} />
                <YAxis {...axis} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="var(--electric)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel delay={0.2}>
          <h2 className="text-sm font-semibold">Model agreement</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Share of models on the majority side — how much they agreed with each other, not how
            many called fraud.
          </p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agreementHistogram}>
                <CartesianGrid stroke="oklch(0.99 0.01 265 / 7%)" vertical={false} />
                <XAxis dataKey="range" {...axis} />
                <YAxis {...axis} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="var(--cyan-accent)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel delay={0.25}>
          <h2 className="text-sm font-semibold">Recent</h2>
          <div className="mt-4 max-h-56 space-y-2 overflow-y-auto pr-1">
            {rows.slice(0, 10).map((r) => (
              <div key={r.id} className="flex items-center gap-3 text-xs">
                <span className="font-mono text-muted-foreground">{short(r.hash)}</span>
                <span className="ml-auto font-mono tabular-nums text-muted-foreground">
                  {r.risk}
                </span>
                <RiskBadge level={r.level} label={verdictLabel(r.verdict)} />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
        Corpus reference — the models were trained on BCCC-DeFiFraudTrans-2025: 1,026,867
        transactions across 4,324 wallets at an 8.65% fraud rate. Those are dataset facts, not
        session activity.
      </p>
    </ModuleShell>
  );
}
