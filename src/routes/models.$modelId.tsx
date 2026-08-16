import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowLeft, Check, Minus } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Meter, ModuleShell, Panel, StatTile } from "@/components/ui-kit";
import { FEATURES, modelById, prCurve, rocCurve } from "@/lib/platform-data";

export const Route = createFileRoute("/models/$modelId")({
  loader: ({ params }) => {
    const model = modelById(params.modelId);
    if (!model) throw notFound();
    return { model };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Model unavailable — Aegis" }, { name: "robots", content: "noindex" }] };
    }
    const { model } = loaderData;
    const description = `${model.name} for Ethereum fraud detection: ${model.tagline} Accuracy ${(model.accuracy * 100).toFixed(1)}%, ROC AUC ${model.rocAuc}.`;
    return {
      meta: [
        { title: `${model.name} — Aegis Model Workspace` },
        { name: "description", content: description },
        { property: "og:title", content: `${model.name} — Aegis Model Workspace` },
        { property: "og:description", content: description },
      ],
    };
  },
  component: ModelPage,
});

const axis = {
  stroke: "oklch(0.66 0.024 264)",
  fontSize: 10,
  fontFamily: "var(--font-mono)",
};

const tooltipStyle = {
  background: "oklch(0.17 0.02 268)",
  border: "1px solid oklch(0.99 0.01 265 / 12%)",
  borderRadius: 12,
  fontSize: 11,
};

function ModelPage() {
  const { model } = Route.useLoaderData();
  const roc = rocCurve(model.rocAuc);
  const pr = prCurve(model.prAuc);
  const cm = model.confusion;

  return (
    <ModuleShell>
      <Link
        to="/models"
        className="inline-flex items-center gap-2 text-xs text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All models
      </Link>

      <motion.header
        initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="mt-6 pb-10"
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-cyan/80">
          {model.family} · {model.params}
        </p>
        <h1 className="mt-3 text-5xl font-semibold sm:text-6xl">{model.name}</h1>
        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          {model.architecture}
        </p>
      </motion.header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Accuracy" value={`${(model.accuracy * 100).toFixed(1)}%`} accent="safe" />
        <StatTile label="F1" value={model.f1.toFixed(3)} accent="cyan" delay={0.05} />
        <StatTile label="ROC AUC" value={model.rocAuc.toFixed(3)} delay={0.1} />
        <StatTile
          label="Inference"
          value={`${model.latencyMs} ms`}
          sub="p50, single prediction"
          accent="violet"
          delay={0.15}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel delay={0.15}>
          <h2 className="text-sm font-semibold">ROC curve</h2>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={roc}>
                <defs>
                  <linearGradient id="rocFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--cyan-accent)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--cyan-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(0.99 0.01 265 / 7%)" vertical={false} />
                <XAxis dataKey="fpr" {...axis} tickFormatter={(v: number) => v.toFixed(1)} />
                <YAxis {...axis} domain={[0, 1]} tickFormatter={(v: number) => v.toFixed(1)} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="tpr"
                  stroke="var(--cyan-accent)"
                  strokeWidth={2}
                  fill="url(#rocFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel delay={0.2}>
          <h2 className="text-sm font-semibold">Precision–recall curve</h2>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pr}>
                <CartesianGrid stroke="oklch(0.99 0.01 265 / 7%)" vertical={false} />
                <XAxis dataKey="recall" {...axis} tickFormatter={(v: number) => v.toFixed(1)} />
                <YAxis {...axis} domain={[0.3, 1]} tickFormatter={(v: number) => v.toFixed(1)} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="precision"
                  stroke="var(--violet-accent)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel delay={0.25}>
          <h2 className="text-sm font-semibold">Confusion matrix</h2>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {[
              ["True negative", cm.tn, "safe"],
              ["False positive", cm.fp, "warn"],
              ["False negative", cm.fn, "risk"],
              ["True positive", cm.tp, "electric"],
            ].map(([label, value, tone], i) => (
              <motion.div
                key={label as string}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + i * 0.07 }}
                className="rounded-2xl border border-white/8 bg-white/3 p-5"
              >
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {label as string}
                </div>
                <div
                  className="mt-2 font-display text-2xl font-semibold tabular-nums"
                  style={{ color: `var(--${tone === "warn" ? "warn" : tone})` }}
                >
                  {(value as number).toLocaleString()}
                </div>
              </motion.div>
            ))}
          </div>
        </Panel>

        <Panel delay={0.3}>
          <h2 className="text-sm font-semibold">Feature importance</h2>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={FEATURES} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="key" {...axis} width={110} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="importance" fill="var(--electric)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel delay={0.35}>
          <h2 className="text-sm font-semibold">SHAP behaviour</h2>
          <ul className="mt-5 space-y-3.5">
            {FEATURES.slice(0, 6).map((f) => (
              <li key={f.key}>
                <div className="flex justify-between text-xs">
                  <span>{f.label}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {f.shap > 0 ? "+" : ""}
                    {f.shap.toFixed(2)}
                  </span>
                </div>
                <div className="mt-2">
                  <Meter value={Math.abs(f.shap) * 190} tone={f.shap > 0 ? "risk" : "safe"} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel delay={0.4}>
          <h2 className="text-sm font-semibold text-safe">Advantages</h2>
          <ul className="mt-5 space-y-3">
            {model.advantages.map((a: string) => (
              <li key={a} className="flex gap-3 text-xs leading-relaxed text-muted-foreground">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-safe" />
                {a}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel delay={0.45}>
          <h2 className="text-sm font-semibold text-risk">Limitations</h2>
          <ul className="mt-5 space-y-3">
            {model.limitations.map((l: string) => (
              <li key={l} className="flex gap-3 text-xs leading-relaxed text-muted-foreground">
                <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-risk" />
                {l}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </ModuleShell>
  );
}
