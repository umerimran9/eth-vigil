import { createFileRoute, Link, notFound } from "@tanstack/react-router";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FEATURES, modelById, prCurve, rocCurve } from "@/lib/platform-data";

export const Route = createFileRoute("/models/$modelId")({
  loader: ({ params }) => {
    const model = modelById(params.modelId);
    if (!model) throw notFound();
    return { model };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Model unavailable — Aegis" }, { name: "robots", content: "noindex" }],
      };
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
  stroke: "var(--muted-foreground)",
  fontSize: 10,
  fontFamily: "var(--font-mono)",
};

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 11,
  color: "var(--foreground)",
};

function ModelPage() {
  const { model } = Route.useLoaderData();
  const roc = rocCurve(model.rocAuc);
  const pr = prCurve(model.prAuc);

  return (
    <ModuleShell>
      <Link
        to="/models"
        className="inline-flex items-center gap-2 text-xs text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All models
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-5 mt-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {model.family} · {model.params}
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold sm:text-3xl">{model.name}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {model.architecture}
          </p>
        </div>

        <Link
          to="/detect"
          search={{ model: model.id.replace(/-/g, "_"), aegisRun: true }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition hover:opacity-90"
        >
          <span>Test {model.name} in Studio</span>
          <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
        </Link>
      </div>

      <div className="inline-flex items-center gap-2 rounded-md border border-warn/30 bg-warn/10 px-3 py-1.5">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warn" />
        <p className="text-xs leading-relaxed text-warn">
          Historical — stored evaluation results, not a live prediction. Run a transaction on
          Investigate to see this model's current-transaction output.
        </p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <Tabs defaultValue="curves" className="mt-4">
        <TabsList>
          <TabsTrigger value="curves">Performance curves</TabsTrigger>
          <TabsTrigger value="signals">Feature signals</TabsTrigger>
          <TabsTrigger value="tradeoffs">Trade-offs</TabsTrigger>
        </TabsList>

        <TabsContent value="curves" className="grid gap-4 lg:grid-cols-2">
          <Panel delay={0.05}>
            <h2 className="text-sm font-semibold">ROC curve</h2>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Illustrative shape derived from the stored ROC-AUC value, not measured threshold-sweep
              points.
            </p>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={roc}>
                  <defs>
                    <linearGradient id="rocFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="fpr" {...axis} tickFormatter={(v: number) => v.toFixed(1)} />
                  <YAxis {...axis} domain={[0, 1]} tickFormatter={(v: number) => v.toFixed(1)} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area
                    type="monotone"
                    dataKey="tpr"
                    stroke="var(--brand)"
                    strokeWidth={2}
                    fill="url(#rocFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel delay={0.1}>
            <h2 className="text-sm font-semibold">Precision–recall curve</h2>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Illustrative shape derived from the stored PR-AUC value, not measured threshold-sweep
              points.
            </p>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pr}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="recall" {...axis} tickFormatter={(v: number) => v.toFixed(1)} />
                  <YAxis {...axis} domain={[0.3, 1]} tickFormatter={(v: number) => v.toFixed(1)} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line
                    type="monotone"
                    dataKey="precision"
                    stroke="var(--brand)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="signals" className="grid gap-4 lg:grid-cols-2">
          <Panel delay={0.05}>
            <h2 className="text-sm font-semibold">Feature importance (ensemble-wide)</h2>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Shared across every model's page — not specific to {model.name}.
            </p>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={FEATURES} layout="vertical" margin={{ left: 8 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="key" {...axis} width={110} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="importance" fill="var(--brand)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel delay={0.1}>
            <h2 className="text-sm font-semibold">Illustrative feature signals</h2>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Reference values, not real SHAP and not specific to {model.name} — see a real
              per-transaction signal breakdown on the Fraud Detection page.
            </p>
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
        </TabsContent>

        <TabsContent value="tradeoffs" className="grid gap-4 lg:grid-cols-2">
          <Panel delay={0.05}>
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

          <Panel delay={0.1}>
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
        </TabsContent>
      </Tabs>
    </ModuleShell>
  );
}
