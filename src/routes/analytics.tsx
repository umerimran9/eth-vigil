import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ModuleShell, PageHeader, Panel, StatTile } from "@/components/ui-kit";
import { FRAUD_TREND, MODEL_USAGE, TIMELINE } from "@/lib/platform-data";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Fraud Trends & Model Usage · Aegis" },
      {
        name: "description",
        content:
          "Fraud trends, prediction timelines, detection statistics and model usage across the Aegis Ethereum monitoring platform.",
      },
      { property: "og:title", content: "Analytics — Fraud Trends & Model Usage · Aegis" },
      {
        property: "og:description",
        content: "Interactive analytics on detection volume, risk over time and model utilisation.",
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
const PIE_COLORS = [
  "var(--electric)",
  "var(--cyan-accent)",
  "var(--violet-accent)",
  "var(--safe)",
  "var(--warn)",
  "var(--risk)",
  "var(--indigo-accent)",
];

function Analytics() {
  return (
    <ModuleShell>
      <PageHeader
        eyebrow="Analytics"
        title="Patterns, not paperwork."
        description="Detection volume, risk concentration and model utilisation across the last rolling window. Charts draw themselves as they enter view."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Txns analysed" value="1,026,867" sub="BCCC dataset" accent="cyan" />
        <StatTile label="Fraud detected" value="88,824" sub="8.65% base rate" accent="risk" delay={0.05} />
        <StatTile label="Unique wallets" value="4,324" sub="wallet-grouped" accent="safe" delay={0.1} />
        <StatTile label="Avg. latency" value="2.6 ms" sub="consensus path" accent="violet" delay={0.15} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel delay={0.1}>
          <h2 className="text-sm font-semibold">Fraud trend</h2>
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={FRAUD_TREND}>
                <defs>
                  <linearGradient id="flaggedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--risk)" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="var(--risk)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="clearedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--cyan-accent)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--cyan-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(0.99 0.01 265 / 7%)" vertical={false} />
                <XAxis dataKey="day" {...axis} />
                <YAxis {...axis} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="cleared"
                  stroke="var(--cyan-accent)"
                  fill="url(#clearedFill)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="flagged"
                  stroke="var(--risk)"
                  fill="url(#flaggedFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel delay={0.15}>
          <h2 className="text-sm font-semibold">Prediction timeline (24h)</h2>
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={TIMELINE}>
                <CartesianGrid stroke="oklch(0.99 0.01 265 / 7%)" vertical={false} />
                <XAxis dataKey="hour" {...axis} interval={3} />
                <YAxis {...axis} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="throughput"
                  stroke="var(--electric)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="risk"
                  stroke="var(--violet-accent)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel delay={0.2}>
          <h2 className="text-sm font-semibold">Model usage</h2>
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MODEL_USAGE}>
                <CartesianGrid stroke="oklch(0.99 0.01 265 / 7%)" vertical={false} />
                <XAxis dataKey="name" {...axis} interval={0} angle={-18} height={50} dy={12} />
                <YAxis {...axis} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="runs" radius={[8, 8, 0, 0]}>
                  {MODEL_USAGE.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel delay={0.25}>
          <h2 className="text-sm font-semibold">Detection distribution</h2>
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: "Legitimate", value: 91.4 },
                    { name: "Elevated", value: 6.2 },
                    { name: "High risk", value: 2.4 },
                  ]}
                  dataKey="value"
                  innerRadius={62}
                  outerRadius={98}
                  paddingAngle={4}
                  stroke="none"
                >
                  {["var(--safe)", "var(--warn)", "var(--risk)"].map((c) => (
                    <Cell key={c} fill={c} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </ModuleShell>
  );
}
