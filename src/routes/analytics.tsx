import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Download,
  Printer,
  SearchCode,
  TrendingUp,
  Sparkles,
  Clock,
  Activity,
  Layers,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { ModuleShell, PageHeader, Panel, RiskBadge, StatTile, short } from "@/components/ui-kit";
import { levelFromVerdict, verdictLabel, MODELS, type RiskLevel } from "@/lib/platform-data";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Aegis" },
      {
        name: "description",
        content:
          "Verdict distribution, risk concentration, model voting bias, and chronological risk trajectory computed from real transaction telemetry.",
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

const axis = { stroke: "rgba(255, 255, 255, 0.25)", fontSize: 10, fontFamily: "var(--font-mono)" };
const tooltipStyle = {
  background: "#111c38",
  border: "1px solid #1e3258",
  borderRadius: 8,
  fontSize: 11,
  color: "#f8fafc",
};

const HISTOGRAM_COLORS = [
  "#00e5a3", // 0-20 (Safe Green)
  "#22d3ee", // 20-40 (Cyan)
  "#ffb547", // 40-60 (Amber)
  "#ff7b47", // 60-80 (Orange)
  "#ff4757", // 80-100 (Red)
];

interface Row {
  id: string;
  hash: string;
  risk: number;
  verdict: string;
  level: RiskLevel;
  confidence: number;
  at: string;
  fromAddress?: string;
  toAddress?: string;
  valueEth?: number;
  gasUsed?: number;
  modelVotes?: Record<string, boolean>;
}

function Analytics() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    apiFetch<any>("/api/v1/history")
      .then(({ ok, data }) => {
        if (ok && Array.isArray(data?.history)) {
          setRows(
            data.history.map((h: any) => {
              const votes: Record<string, boolean> = {};
              if (Array.isArray(h.model_scores)) {
                h.model_scores.forEach((m: any) => {
                  const mId = (m.model_id || "").toLowerCase().replace(/-/g, "_");
                  votes[mId] = m.verdict === "FRAUD" || m.verdict === "SUSPICIOUS_ACTIVITY";
                });
              }

              return {
                id: h.id,
                hash: h.hash,
                risk: h.risk,
                verdict: h.verdict ?? "",
                level: levelFromVerdict(h.verdict, h.risk),
                confidence: h.confidence ?? 0,
                at: h.at,
                fromAddress: h.from_address || h.transaction?.from_address,
                toAddress: h.to_address || h.transaction?.to_address,
                valueEth: h.value_eth ?? h.transaction?.value_eth ?? 0,
                gasUsed: h.transaction?.gas_used ?? 21000,
                modelVotes: votes,
              };
            }),
          );
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  const loadDemoAnalytics = () => {
    const demoRows: Row[] = [
      {
        id: "AN-DEMO-1",
        hash: "0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359",
        risk: 89.4,
        verdict: "FRAUD",
        level: "high",
        confidence: 0.83,
        at: new Date(Date.now() - 60000).toISOString(),
        fromAddress: "0x71c000000000000000000000000000000001c81a",
        toAddress: "0x1111111254fb6c44bac0bed2854e76f90643097d",
        valueEth: 4.2,
        gasUsed: 145000,
        modelVotes: { lightgbm: true, xgboost: true, random_forest: true, logistic_regression: true, mlp: true, transformer: false },
      },
      {
        id: "AN-DEMO-2",
        hash: "0x9a191d4e4cb1b6faa2625fe562bdd9a23260359",
        risk: 49.2,
        verdict: "LEGITIMATE",
        level: "safe",
        confidence: 0.67,
        at: new Date(Date.now() - 120000).toISOString(),
        fromAddress: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
        toAddress: "0x388c818ca8b9251b393131c08a736a67ccb19297",
        valueEth: 0.0,
        gasUsed: 21000,
        modelVotes: { lightgbm: false, xgboost: false, random_forest: false, logistic_regression: true, mlp: false, transformer: false },
      },
      {
        id: "AN-DEMO-3",
        hash: "0x819a356b4ccb1b6faa2625fe562bdd9a23260359",
        risk: 58.7,
        verdict: "SUSPICIOUS_ACTIVITY",
        level: "elevated",
        confidence: 0.5,
        at: new Date(Date.now() - 180000).toISOString(),
        fromAddress: "0x28c6c06298d514db089934071355e5743bf21d60",
        toAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        valueEth: 12.5,
        gasUsed: 84200,
        modelVotes: { lightgbm: true, xgboost: true, random_forest: false, logistic_regression: true, mlp: false, transformer: false },
      },
      {
        id: "AN-DEMO-4",
        hash: "0x0000002b4ccb1b6faa2625fe562bdd9a23260359",
        risk: 96.1,
        verdict: "FRAUD",
        level: "high",
        confidence: 1.0,
        at: new Date(Date.now() - 240000).toISOString(),
        fromAddress: "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503",
        toAddress: "0x7a250d5630b4cf539739df2c5dacb4c659f2488d",
        valueEth: 0.0,
        gasUsed: 231000,
        modelVotes: { lightgbm: true, xgboost: true, random_forest: true, logistic_regression: true, mlp: true, transformer: true },
      },
      {
        id: "AN-DEMO-5",
        hash: "0x7770001b4ccb1b6faa2625fe562bdd9a23260359",
        risk: 14.2,
        verdict: "LEGITIMATE",
        level: "safe",
        confidence: 0.83,
        at: new Date(Date.now() - 300000).toISOString(),
        fromAddress: "0xde0b295669a9fd93d5f28d9ec85e40f4cb697bae",
        toAddress: "0x524cab2ec69124574082676e6f654a18df49a048",
        valueEth: 1.0,
        gasUsed: 21000,
        modelVotes: { lightgbm: false, xgboost: false, random_forest: false, logistic_regression: false, mlp: false, transformer: false },
      },
      {
        id: "AN-DEMO-6",
        hash: "0x3330001b4ccb1b6faa2625fe562bdd9a23260359",
        risk: 22.8,
        verdict: "LEGITIMATE",
        level: "safe",
        confidence: 0.83,
        at: new Date(Date.now() - 360000).toISOString(),
        fromAddress: "0x5a52e96bacdabb82fd05763e25335261b270efcb",
        toAddress: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        valueEth: 0.5,
        gasUsed: 35000,
        modelVotes: { lightgbm: false, xgboost: false, random_forest: false, logistic_regression: false, mlp: false, transformer: false },
      },
      {
        id: "AN-DEMO-7",
        hash: "0x9990001b4ccb1b6faa2625fe562bdd9a23260359",
        risk: 78.4,
        verdict: "SUSPICIOUS_ACTIVITY",
        level: "elevated",
        confidence: 0.67,
        at: new Date(Date.now() - 420000).toISOString(),
        fromAddress: "0x6b175474e89094c44da98b954eedeac495271d0f",
        toAddress: "0x1111111254fb6c44bac0bed2854e76f90643097d",
        valueEth: 0.0,
        gasUsed: 165000,
        modelVotes: { lightgbm: true, xgboost: true, random_forest: false, logistic_regression: true, mlp: true, transformer: false },
      },
      {
        id: "AN-DEMO-8",
        hash: "0x1110001b4ccb1b6faa2625fe562bdd9a23260359",
        risk: 8.5,
        verdict: "LEGITIMATE",
        level: "safe",
        confidence: 1.0,
        at: new Date(Date.now() - 480000).toISOString(),
        fromAddress: "0xbe0eb53f46cd790cd13851d5eff43d12404d33e8",
        toAddress: "0x7a250d5630b4cf539739df2c5dacb4c659f2488d",
        valueEth: 0.25,
        gasUsed: 21000,
        modelVotes: { lightgbm: false, xgboost: false, random_forest: false, logistic_regression: false, mlp: false, transformer: false },
      },
    ];
    setRows(demoRows);
    toast.success("Loaded demo session analytics telemetry");
  };

  const exportCSV = () => {
    if (!rows.length) return;
    const headers = ["ID", "Hash", "From", "To", "Value_ETH", "Risk_Score", "Verdict", "Timestamp"];
    const csvContent = [
      headers.join(","),
      ...rows.map((r) =>
        [
          `"${r.id}"`,
          `"${r.hash}"`,
          `"${r.fromAddress || ""}"`,
          `"${r.toAddress || ""}"`,
          r.valueEth ?? 0,
          r.risk,
          `"${r.verdict}"`,
          `"${r.at}"`,
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `aegis_analytics_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Analytics session CSV exported successfully");
  };

  const exportPDF = () => {
    window.print();
  };

  const verdictDist = useMemo(() => {
    const c: Record<RiskLevel, number> = { safe: 0, elevated: 0, high: 0 };
    rows.forEach((r) => c[r.level]++);
    return [
      { name: "Clear", value: c.safe, color: "#00e5a3" },
      { name: "Medium", value: c.elevated, color: "#ffb547" },
      { name: "High Risk", value: c.high, color: "#ff4757" },
    ];
  }, [rows]);

  const riskHistogram = useMemo(() => {
    const b = [0, 0, 0, 0, 0];
    rows.forEach((r) => b[Math.min(4, Math.floor(r.risk / 20))]!++);
    return b.map((count, i) => ({
      range: `${i * 20}–${i * 20 + 20}`,
      count,
      color: HISTOGRAM_COLORS[i],
    }));
  }, [rows]);

  // Chronological Risk Trajectory (Time Series)
  const timelineData = useMemo(() => {
    const sorted = [...rows].reverse();
    return sorted.map((r, i) => ({
      index: `#${i + 1}`,
      risk: r.risk,
      hash: short(r.hash, 6),
      verdict: r.verdict,
    }));
  }, [rows]);

  // Model Bias / Flag Rate Comparison
  const modelFlagStats = useMemo(() => {
    return MODELS.map((m) => {
      const mId = m.id.replace(/-/g, "_");
      let flagged = 0;
      let evaluated = 0;

      rows.forEach((r) => {
        if (r.modelVotes && mId in r.modelVotes) {
          evaluated++;
          if (r.modelVotes[mId]) flagged++;
        }
      });

      const rate = evaluated > 0 ? Number(((flagged / evaluated) * 100).toFixed(1)) : 0;
      return {
        name: m.name,
        flagRate: rate,
        flaggedCount: flagged,
        total: evaluated,
      };
    });
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
          description="This page computes its statistics from transactions this backend has actually scored. Run an investigation, watch live blocks, or load the demo telemetry."
          aside={
            <button
              onClick={loadDemoAnalytics}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-[#111c38] px-4 py-2 text-xs font-medium text-foreground transition hover:border-primary"
            >
              <Sparkles className="h-4 w-4 text-cyan" />
              Load Demo Analytics
            </button>
          }
        />
        <Panel>
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <Activity className="h-10 w-10 text-muted-foreground/50" />
            <h3 className="text-sm font-semibold text-foreground">No analyses in this session's history</h3>
            <p className="max-w-md text-xs text-muted-foreground">
              Once transactions are evaluated via the Detect page, Monitor feed, or Batch scoring, real-time analytics will automatically populate.
            </p>
            <div className="mt-2 flex gap-3">
              <button
                onClick={loadDemoAnalytics}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                <Sparkles className="h-4 w-4" /> Load Demo Telemetry
              </button>
              <Link
                to="/detect"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-[#0e1832] px-5 py-2.5 text-xs font-medium text-foreground transition hover:border-primary"
              >
                Start an investigation →
              </Link>
            </div>
          </div>
        </Panel>
      </ModuleShell>
    );
  }

  return (
    <ModuleShell>
      <PageHeader
        eyebrow="Analytics & Telemetry"
        title="Patterns, not paperwork."
        description="Verdict distribution, model voting bias, and chronological risk trajectory computed from real scored transactions."
        aside={
          <div className="flex items-center gap-2">
            <button
              onClick={exportPDF}
              disabled={rows.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-40"
            >
              <Printer className="h-3.5 w-3.5" />
              Export Analytics PDF
            </button>
            <button
              onClick={exportCSV}
              disabled={rows.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-[#111c38] px-4 py-2 text-xs font-medium text-foreground transition hover:border-primary disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5 text-cyan" />
              Export CSV
            </button>
          </div>
        }
      />

      {/* Top 4 Stat Tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 print:gap-2.5 print:mb-2.5">
        <StatTile label="Analyses" value={String(rows.length)} sub="scored this session" accent="cyan" />
        <StatTile
          label="High Risk"
          value={String(highRisk)}
          sub="flagged fraud"
          accent="risk"
          delay={0.05}
        />
        <StatTile
          label="Avg. Risk"
          value={rows.length ? avgRisk.toFixed(1) : "—"}
          sub="0–100 risk scale"
          accent="violet"
          delay={0.1}
        />
        <StatTile
          label="Avg. Agreement"
          value={rows.length ? `${avgAgreement.toFixed(0)}%` : "—"}
          sub="ensemble voting strength"
          accent="safe"
          delay={0.15}
        />
      </div>

      {/* Main Charts Grid (4 Cards in 2x2 Grid) */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2 print:mt-2.5 print:grid-cols-2 print:gap-2.5 print:break-inside-avoid">
        {/* 1. Verdict Distribution Donut Chart with Center Metric */}
        <Panel delay={0.1}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold print:text-xs">Verdict Distribution</h2>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground print:text-[8px]">
              Categorical Breakdown
            </span>
          </div>

          <div className="relative mt-4 h-64 print:mt-1.5 print:h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={verdictDist}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  stroke="none"
                >
                  {verdictDist.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>

            {/* Centered Metric in Donut Hole */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-5">
              <span className="font-mono text-2xl font-bold text-foreground print:text-lg">
                {rows.length}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground print:text-[7px]">
                Total Scored
              </span>
            </div>
          </div>
        </Panel>

        {/* 2. Color-Coded Risk Score Distribution Histogram */}
        <Panel delay={0.15}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold print:text-xs">Risk Score Distribution</h2>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground print:text-[8px]">
              0-100 Histogram
            </span>
          </div>

          <div className="mt-4 h-64 print:mt-1.5 print:h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskHistogram}>
                <CartesianGrid stroke="#1e3258" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="range" {...axis} tick={{ fontSize: 10 }} />
                <YAxis {...axis} allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                  {riskHistogram.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* 3. Chronological Risk Trajectory (Time Series Area Chart) */}
        <Panel delay={0.2}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold print:text-xs">
                <TrendingUp className="h-4 w-4 text-cyan print:h-3 print:w-3" /> Risk Trajectory Timeline
              </h2>
              <p className="mt-1 text-[11px] text-muted-foreground print:text-[9px] print:mt-0">
                Sequential fraud probability across analyzed transactions (Threshold: 50% Elevated, 85% Fraud).
              </p>
            </div>
          </div>

          <div className="mt-4 h-56 print:mt-1.5 print:h-38">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="riskAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0784c3" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0784c3" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1e3258" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="index" {...axis} tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} {...axis} tick={{ fontSize: 10 }} />
                <ReferenceLine y={50} stroke="#ffb547" strokeDasharray="3 3" label={{ value: "Elevated", fill: "#ffb547", fontSize: 8 }} />
                <ReferenceLine y={85} stroke="#ff4757" strokeDasharray="3 3" label={{ value: "High Risk", fill: "#ff4757", fontSize: 8 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="risk" stroke="#0784c3" strokeWidth={2} fillOpacity={1} fill="url(#riskAreaGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* 4. Per-Model Flag Rate Comparison (Voting Bias) */}
        <Panel delay={0.25}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold print:text-xs">
                <Layers className="h-4 w-4 text-electric print:h-3 print:w-3" /> Model Flagging Bias
              </h2>
              <p className="mt-1 text-[11px] text-muted-foreground print:text-[9px] print:mt-0">
                Individual model fraud detection trigger rate across this session's evaluations.
              </p>
            </div>
          </div>

          <div className="mt-4 h-56 print:mt-1.5 print:h-38">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modelFlagStats} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid stroke="#1e3258" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} unit="%" {...axis} tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" width={95} {...axis} tick={{ fontSize: 9 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="flagRate" name="Flag Rate %" fill="#0784c3" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* 5. Interactive Recent Scored Transactions Card (Hidden in Print for 1-Page Landscape Output) */}
      <Panel delay={0.3} className="mt-4 p-0 overflow-hidden no-print">
        <div className="flex items-center justify-between border-b border-border bg-[#0e1832] px-6 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="h-4 w-4 text-cyan" /> Recent Investigations Telemetry
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Click any row to inspect deep SHAP feature attribution
          </span>
        </div>

        <div className="divide-y divide-border">
          {rows.slice(0, 8).map((r) => (
            <Link
              key={r.id}
              to="/detect"
              search={{
                from: r.fromAddress,
                to: r.toAddress,
                value: String(r.valueEth ?? "0"),
                gas: String(r.gasUsed ?? "21000"),
                hash: r.hash,
                auto: "true",
              }}
              className="flex flex-wrap items-center justify-between gap-4 px-6 py-3.5 transition hover:bg-[#152446]/60"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-cyan font-medium">
                  {short(r.hash, 8)}
                </span>
                {r.fromAddress && (
                  <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
                    From: {short(r.fromAddress, 4)}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4">
                {typeof r.valueEth === "number" && (
                  <span className="font-mono text-xs tabular-nums text-foreground">
                    {r.valueEth.toFixed(2)} Ξ
                  </span>
                )}
                <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
                  {r.risk.toFixed(1)} / 100
                </span>
                <RiskBadge level={r.level} label={verdictLabel(r.verdict)} />
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      </Panel>
    </ModuleShell>
  );
}
