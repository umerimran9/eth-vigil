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
import {
  EmptyState,
  ModuleShell,
  PageHeader,
  Panel,
  RiskBadge,
  SectionHeading,
  short,
} from "@/components/ui-kit";
import { levelFromVerdict, verdictLabel } from "@/lib/platform-data";
import { apiFetch } from "@/lib/api";
import type { RiskLevel } from "@/lib/platform-data";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Aegis" },
      {
        name: "description",
        content:
          "Real aggregate statistics computed from this session's analysis history — no fabricated data.",
      },
      { property: "og:title", content: "Analytics — Aegis" },
      {
        property: "og:description",
        content: "Verdict distribution, risk histogram and recent activity, all from real history.",
      },
    ],
  }),
  component: Analytics,
});

const axis = { stroke: "var(--muted-foreground)", fontSize: 10, fontFamily: "var(--font-mono)" };
const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 11,
  color: "var(--foreground)",
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

// Every number on this page is computed from the real GET /api/v1/history
// payload -- this route previously showed 100% hardcoded stats/charts; that
// content is gone, not relabeled.
function Analytics() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    apiFetch<any>("/api/v1/history")
      .then(({ ok, data }) => {
        if (ok && data?.history) {
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
    const counts: Record<RiskLevel, number> = { safe: 0, elevated: 0, high: 0 };
    rows.forEach((r) => counts[r.level]++);
    return [
      { name: "Legitimate", value: counts.safe, color: "var(--safe)" },
      { name: "Elevated", value: counts.elevated, color: "var(--warn)" },
      { name: "High risk", value: counts.high, color: "var(--risk)" },
    ];
  }, [rows]);

  const riskHistogram = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0];
    rows.forEach((r) => {
      const idx = Math.min(4, Math.floor(r.risk / 20));
      buckets[idx]!++;
    });
    return buckets.map((count, i) => ({ range: `${i * 20}-${i * 20 + 20}`, count }));
  }, [rows]);

  const agreementHistogram = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0];
    rows.forEach((r) => {
      const idx = Math.min(4, Math.floor((r.confidence * 100) / 20));
      buckets[idx]!++;
    });
    return buckets.map((count, i) => ({ range: `${i * 20}-${i * 20 + 20}%`, count }));
  }, [rows]);

  const avgRisk = rows.length ? rows.reduce((s, r) => s + r.risk, 0) / rows.length : 0;
  const avgAgreement = rows.length
    ? (rows.reduce((s, r) => s + r.confidence, 0) / rows.length) * 100
    : 0;
  const highRisk = rows.filter((r) => r.level === "high");
  const recent = rows.slice(0, 8);

  if (loaded && rows.length === 0) {
    return (
      <ModuleShell>
        <PageHeader title="Analytics" />
        <Panel>
          <EmptyState
            title="Nothing analysed yet"
            body="Analytics aggregates this session's investigations. Run one and the charts fill in."
            action={
              <Link
                to="/detect"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              >
                Start an investigation
              </Link>
            }
          />
        </Panel>
      </ModuleShell>
    );
  }

  return (
    <ModuleShell>
      <PageHeader
        title="Analytics"
        description={`Aggregates over the ${rows.length} analysis${rows.length === 1 ? "" : "es"} run against this backend session. Restarting the backend clears them.`}
      />

      {/* Three charts and a list, laid out in one scroll. They were behind
          three tabs, which meant a page of four visualisations required three
          clicks to see -- tabs used as pagination for content that fits. */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Panel>
          <SectionHeading title="Verdict distribution" />
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={verdictDist}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={56}
                  outerRadius={88}
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

        <Panel>
          <SectionHeading title="Risk score" hint="Count of analyses per 20-point band." />
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskHistogram}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="range" {...axis} />
                <YAxis {...axis} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="var(--brand)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Panel>
          <SectionHeading title="Model agreement" hint="How often the ensemble converged." />
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agreementHistogram}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="range" {...axis} />
                <YAxis {...axis} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="var(--brand)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="p-0">
          <div className="px-5 py-4">
            <SectionHeading
              title="Recent"
              hint={`${highRisk.length} of ${rows.length} flagged high risk · average ${avgRisk.toFixed(1)} · agreement ${avgAgreement.toFixed(0)}%`}
            />
          </div>
          <div className="max-h-56 overflow-y-auto border-t border-border">
            {recent.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 border-b border-border px-5 py-2 text-xs last:border-b-0"
              >
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
    </ModuleShell>
  );
}
