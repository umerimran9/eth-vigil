import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Box,
  Brain,
  Download,
  FileCheck,
  Flame,
  FolderSearch,
  Gauge,
  HelpCircle,
  Layers,
  Radar,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  EmptyState,
  ModuleShell,
  Panel,
  RiskBadge,
  SectionHeading,
  SkeletonRows,
  short,
} from "@/components/ui-kit";
import { BlockchainHero3D } from "@/components/BlockchainHero3D";
import { NetworkTelemetry } from "@/components/NetworkTelemetry";
import { LiveThreatFeed } from "@/components/LiveThreatFeed";
import { useNetworkState } from "@/lib/network-state";
import {
  MODELS,
  SAMPLE_PRESETS,
  levelFromVerdict,
  verdictLabel,
  type RiskLevel,
} from "@/lib/platform-data";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aegis — Ethereum Security Intelligence" },
      {
        name: "description",
        content:
          "Web3-native Ethereum security command center and fraud detection platform with 7 ML models, natural-language SHAP explainability, and real-time threat intelligence.",
      },
    ],
  }),
  component: Home,
});

interface Row {
  id: string;
  hash: string;
  verdict: string;
  risk: number;
  level: RiskLevel;
  at: string;
  from?: string;
  to?: string;
  value?: string;
}

// 24H Threat Activity Mock Series matching Web3 security events
const THREAT_ACTIVITY_DATA = {
  "24H": [
    { time: "00:00", threats: 42, volume: 180, riskScore: 78 },
    { time: "04:00", threats: 28, volume: 140, riskScore: 65 },
    { time: "08:00", threats: 65, volume: 290, riskScore: 88 },
    { time: "12:00", threats: 89, volume: 410, riskScore: 92 },
    { time: "16:00", threats: 54, volume: 320, riskScore: 84 },
    { time: "20:00", threats: 98, volume: 490, riskScore: 95 },
    { time: "23:59", threats: 76, volume: 380, riskScore: 89 },
  ],
  "7D": [
    { time: "Mon", threats: 320, volume: 1400, riskScore: 82 },
    { time: "Tue", threats: 410, volume: 1850, riskScore: 89 },
    { time: "Wed", threats: 290, volume: 1200, riskScore: 75 },
    { time: "Thu", threats: 540, volume: 2400, riskScore: 94 },
    { time: "Fri", threats: 480, volume: 2100, riskScore: 91 },
    { time: "Sat", threats: 210, volume: 950, riskScore: 68 },
    { time: "Sun", threats: 231, volume: 1050, riskScore: 72 },
  ],
  "30D": [
    { time: "Week 1", threats: 1820, volume: 8200, riskScore: 84 },
    { time: "Week 2", threats: 2410, volume: 10400, riskScore: 91 },
    { time: "Week 3", threats: 1950, volume: 8900, riskScore: 79 },
    { time: "Week 4", threats: 2481, volume: 11200, riskScore: 93 },
  ],
};

const THREAT_DISTRIBUTION_DATA = [
  { name: "Critical", value: 18, color: "#f43f5e" },
  { name: "High", value: 43, color: "#fb923c" },
  { name: "Medium", value: 57, color: "#f59e0b" },
  { name: "Low", value: 24, color: "#64748b" },
  { name: "Resolved", value: 98, color: "#10b981" },
];

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * 64;
      const min = Math.min(...data);
      const max = Math.max(...data);
      const range = max - min || 1;
      const y = 20 - ((val - min) / range) * 16;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className="h-6 w-16 overflow-visible" viewBox="0 0 64 24">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function Home() {
  const navigate = useNavigate();
  const [hash, setHash] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFypGuide, setShowFypGuide] = useState(false);
  const [timeRange, setTimeRange] = useState<"24H" | "7D" | "30D">("24H");
  const net = useNetworkState();

  useEffect(() => {
    let mounted = true;
    apiFetch<any>("/api/v1/history")
      .then(({ ok, data }) => {
        if (!mounted) return;
        if (ok && Array.isArray(data?.history)) {
          const list = data.history.map((h: any) => {
            const risk = Number(h.risk) || 0;
            return {
              id: h.id,
              hash: h.hash,
              verdict: h.verdict ?? (risk >= 0.7 ? "FRAUD" : risk >= 0.4 ? "SUSPICIOUS_ACTIVITY" : "LEGITIMATE"),
              risk: risk <= 1 ? risk * 100 : risk,
              level: levelFromVerdict(h.verdict, risk),
              at: h.at ?? new Date().toISOString(),
              from: h.from,
              to: h.to,
              value: h.value,
            };
          });
          setRows(list);
        } else {
          setRows(FALLBACK_ROWS);
        }
      })
      .catch(() => {
        if (mounted) setRows(FALLBACK_ROWS);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const summary = useMemo(() => {
    const total = rows.length;
    const high = rows.filter((r) => r.level === "high").length;
    const elevated = rows.filter((r) => r.level === "elevated").length;
    const avg = total ? rows.reduce((s, r) => s + r.risk, 0) / total : 0;
    return { total, high, elevated, avg };
  }, [rows]);

  const recent = rows.slice(0, 5);

  const analyse = () => {
    if (!hash.trim()) return;
    navigate({ to: "/detect", search: { hash: hash.trim(), aegisRun: true } });
  };

  const loadPreset = (preset: (typeof SAMPLE_PRESETS)[number]) => {
    navigate({
      to: "/detect",
      search: {
        hash: preset.hash,
        from: preset.from,
        to: preset.to,
        value: preset.value,
        aegisRun: true,
      },
    });
  };

  return (
    <ModuleShell>
      <div className="space-y-6">
        {/* Top Hero / Greeting Context Bar */}
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Ethereum Security Overview
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-safe/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-safe border border-safe/20">
                <span className="h-1.5 w-1.5 rounded-full bg-safe animate-pulse" />
                Mainnet Live
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Monitor on-chain activity, detect fraudulent behavior, and investigate high-risk smart contract anomalies.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 rounded-xl border border-border bg-secondary/60 px-3 py-1.5 text-xs font-mono text-muted-foreground">
              <span>Block:</span>
              <span className="font-bold text-foreground tabular-nums">{net.blockLabel}</span>
            </div>

            <button
              onClick={() => setShowFypGuide(!showFypGuide)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-accent"
            >
              <HelpCircle className="h-4 w-4 text-primary" />
              <span>{showFypGuide ? "Hide Pipeline" : "33/61 Feature Pipeline"}</span>
            </button>
          </div>
        </div>

        {/* Collapsible Educational Feature Pipeline Banner */}
        {showFypGuide ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-xs leading-relaxed text-foreground shadow-xs">
            <div className="flex items-center gap-2 text-sm font-bold text-primary font-mono">
              <Brain className="h-4 w-4" />
              <span>FYP On-Chain Feature Engineering Pipeline (61 Dimensions)</span>
            </div>
            <p className="mt-1.5 text-muted-foreground">
              Raw RPC transaction payloads (hash, sender, receiver, gas, value) are transformed into a <strong>61-dimensional feature vector</strong> containing 33 core wallet behavioral statistics, temporal era-relative z-scores, and token lexical heuristics.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3 text-xs">
              <div className="rounded-xl border border-border bg-card p-3">
                <span className="font-semibold text-foreground">1. Wallet Historical Metrics (33)</span>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Evaluates historical ERC-20 transfer velocities, unique contract creation counts, and token symbol heuristics.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <span className="font-semibold text-foreground">2. Era-Relative Z-Scores (28)</span>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Normalizes gas price and efficiency against block epoch baselines to isolate flash-loan exploits and MEV spikes.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <span className="font-semibold text-foreground">3. 7-Model Ensemble Consensus</span>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Aggregates LightGBM, XGBoost, RF, TabNet, FT-Transformer, MLP, and LogReg with natural-language SHAP explainability.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Chain telemetry replaces generic KPI cards */}
        <NetworkTelemetry
          lastScanLabel={recent[0] ? verdictLabel(recent[0].verdict) : undefined}
          flagged={summary.high}
        />

        {/* Live scan log, chain-native */}
        <LiveThreatFeed rows={recent} loading={loading} />

        {/* MAIN ANALYTICAL AREA (65% Threat Activity Line/Area Chart + 35% Threat Distribution Donut) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Col 1 (8 cols - 65% width): Ethereum Threat Activity Area Chart */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <h2 className="text-base font-bold text-foreground">Ethereum Threat Activity</h2>
                <p className="text-xs text-muted-foreground">
                  Detected fraud anomalies and risk score trajectory across block epochs
                </p>
              </div>

              {/* Time Selector Pills */}
              <div className="flex items-center gap-1 rounded-xl border border-border bg-secondary p-1">
                {(["24H", "7D", "30D"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTimeRange(t)}
                    className={cn(
                      "rounded-lg px-3 py-1 text-xs font-semibold transition-all",
                      timeRange === t
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={THREAT_ACTIVITY_DATA[timeRange]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorThreats" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      borderRadius: "0.75rem",
                      fontSize: "12px",
                      color: "var(--foreground)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="threats"
                    name="Threat Events"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorThreats)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Col 2 (4 cols - 35% width): Threat Distribution Donut */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-4">
            <div>
              <div className="border-b border-border pb-4">
                <h2 className="text-base font-bold text-foreground">Threat Distribution</h2>
                <p className="text-xs text-muted-foreground">Detections categorised by severity level</p>
              </div>

              <div className="relative mt-4 flex h-48 items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={THREAT_DISTRIBUTION_DATA}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {THREAT_DISTRIBUTION_DATA.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                {/* Center Stat */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-extrabold tracking-tight text-foreground">142</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    High-Risk
                  </span>
                </div>
              </div>
            </div>

            {/* Severity Legend */}
            <div className="mt-2 space-y-2 border-t border-border pt-4 text-xs">
              {THREAT_DISTRIBUTION_DATA.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="font-mono font-bold text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* THIRD OPERATIONAL ROW (3 Modular Cards matching reference) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Card 1: Recent Investigations */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground">Recent Investigations</h3>
              <Link to="/cases" className="text-xs font-semibold text-primary hover:underline">
                View All →
              </Link>
            </div>

            <div className="mt-4 divide-y divide-border/60">
              {recent.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">No recent cases recorded.</p>
              ) : (
                recent.map((r, i) => (
                  <div key={r.id || i} className="flex items-center justify-between py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-foreground">
                          {short(r.hash, 8)}
                        </span>
                        <RiskBadge level={r.level} />
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        Risk Score: {r.risk.toFixed(1)}%
                      </div>
                    </div>

                    <button
                      onClick={() => navigate({ to: "/detect", search: { hash: r.hash, aegisRun: true } })}
                      className="rounded-lg border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-primary hover:text-primary-foreground"
                    >
                      Inspect
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Card 2: ML Model Ensemble */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground">ML Model Ensemble</h3>
              <span className="rounded-full bg-safe/10 px-2 py-0.5 font-mono text-[10px] font-bold text-safe">
                7 Online
              </span>
            </div>

            <div className="mt-4 space-y-2.5">
              {[
                { name: "XGBoost", score: 94.2, status: "Active" },
                { name: "LightGBM", score: 91.8, status: "Active" },
                { name: "Random Forest", score: 89.4, status: "Active" },
                { name: "FT-Transformer", score: 95.0, status: "Active" },
              ].map((m) => (
                <div key={m.name} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{m.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-foreground">{m.score}%</span>
                    <span className="text-[10px] text-safe">● {m.status}</span>
                  </div>
                </div>
              ))}

              <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
                <div className="font-semibold text-primary">Ensemble Consensus</div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  4/4 Models Converged on High Risk Detection
                </p>
              </div>
            </div>
          </div>

          {/* Card 3: Ethereum Network Health */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground">Ethereum Network</h3>
              <span className="flex items-center gap-1.5 text-xs text-safe font-semibold">
                <span className="h-2 w-2 rounded-full bg-safe animate-pulse" />
                Operational
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-border bg-secondary/50 p-3">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">Block Number</span>
                <div className="mt-1 font-mono text-sm font-bold text-foreground">#19,485,021</div>
              </div>
              <div className="rounded-xl border border-border bg-secondary/50 p-3">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">Base Fee</span>
                <div className="mt-1 font-mono text-sm font-bold text-foreground">28 Gwei</div>
              </div>
              <div className="rounded-xl border border-border bg-secondary/50 p-3">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">Block Time</span>
                <div className="mt-1 font-mono text-sm font-bold text-foreground">12.1s</div>
              </div>
              <div className="rounded-xl border border-border bg-secondary/50 p-3">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">ML Latency</span>
                <div className="mt-1 font-mono text-sm font-bold text-safe">~1.8 ms</div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
              <span className="text-muted-foreground">Detection Engine Status</span>
              <span className="font-semibold text-safe">P2P Synchronized</span>
            </div>
          </div>
        </div>

        {/* 3D Blockchain Topology Canvas */}
        <BlockchainHero3D />

        {/* Instant On-Chain Transaction Scorer & Attack Presets */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-bold text-foreground">Instant Transaction Investigation</h2>
            <p className="text-xs text-muted-foreground">
              Score any Ethereum transaction hash across 7 AI models with natural-language SHAP explainability.
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
            <input
              value={hash}
              onChange={(e) => setHash(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") analyse();
              }}
              placeholder="0x8a3f9e2b1c4d5a6e7f8a9b0c… or paste Ethereum transaction hash"
              className="min-w-0 flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 font-mono text-xs text-foreground shadow-xs transition focus:border-primary focus:outline-none"
            />
            <button
              onClick={analyse}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm shadow-primary/25 transition hover:opacity-90"
            >
              <Radar className="h-4 w-4" />
              <span>Score Transaction</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Real Attack Vector Presets */}
          <div className="mt-5 border-t border-border pt-4">
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Attack Presets & Real Benchmarks
              </span>
              <span className="text-[11px] text-muted-foreground">Click to load benchmark</span>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {SAMPLE_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => loadPreset(preset)}
                  className="flex flex-col rounded-xl border border-border bg-secondary/40 p-3 text-left transition hover:border-primary/50 hover:bg-secondary"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-foreground">{preset.name}</span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[9px] font-bold",
                        preset.type === "High Risk"
                          ? "bg-risk/10 text-risk border border-risk/20"
                          : "bg-safe/10 text-safe border border-safe/20",
                      )}
                    >
                      {preset.type}
                    </span>
                  </div>
                  <span className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {preset.value} ETH · {preset.gasUsed} gas
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}

const FALLBACK_ROWS: Row[] = [
  {
    id: "tx-1",
    hash: "0x8a3f9e2b1c4d5a6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e",
    verdict: "FRAUD",
    risk: 94.2,
    level: "high",
    at: new Date(Date.now() - 12000).toISOString(),
  },
  {
    id: "tx-2",
    hash: "0x91c28ae4b5d6f7a8c9e0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2",
    verdict: "SUSPICIOUS_ACTIVITY",
    risk: 87.5,
    level: "elevated",
    at: new Date(Date.now() - 42000).toISOString(),
  },
  {
    id: "tx-3",
    hash: "0x71ab90ced1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8",
    verdict: "LEGITIMATE",
    risk: 12.0,
    level: "safe",
    at: new Date(Date.now() - 120000).toISOString(),
  },
];
