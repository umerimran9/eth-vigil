import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowUpRight, Cpu } from "lucide-react";
import { ModuleShell, PageHeader, Panel } from "@/components/ui-kit";
import { MODELS } from "@/lib/platform-data";

export const Route = createFileRoute("/models/")({
  head: () => ({
    meta: [
      { title: "AI Models — Aegis Ensemble" },
      {
        name: "description",
        content:
          "Seven production fraud-detection models: LightGBM, XGBoost, Random Forest, Logistic Regression, MLP, FT Transformer and TabNet, with full metrics.",
      },
      { property: "og:title", content: "AI Models — Aegis Ensemble" },
      {
        property: "og:description",
        content: "Explore architecture, metrics and inference speed for each model in the ensemble.",
      },
    ],
  }),
  component: Models,
});

function Models() {
  return (
    <ModuleShell>
      <PageHeader
        eyebrow="AI models"
        title="Seven specialists, fully instrumented."
        description="Each model is a first-class workspace: architecture, ROC and PR curves, confusion matrix, SHAP behaviour, latency envelope, advantages and honest limitations."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {MODELS.map((m, i) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ y: -7 }}
            style={{ transformPerspective: 1000 }}
          >
            <Link
              to="/models/$modelId"
              params={{ modelId: m.id }}
              className="group relative block h-full overflow-hidden rounded-3xl glass-panel p-7"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan/80">
                    {m.family}
                  </span>
                  <h2 className="mt-2 font-display text-2xl font-semibold">{m.name}</h2>
                </div>
                <Cpu className="h-5 w-5 text-electric" strokeWidth={1.5} />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{m.tagline}</p>

              <dl className="mt-7 grid grid-cols-3 gap-3 border-t border-white/8 pt-5">
                {[
                  ["PR AUC", m.prAuc.toFixed(3)],
                  ["ROC AUC", m.rocAuc.toFixed(3)],
                  ["Latency", `${m.latencyMs} ms`],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                      {k}
                    </dt>
                    <dd className="mt-1 font-display text-base font-semibold tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>

              <span className="mt-6 inline-flex items-center gap-1.5 text-xs text-cyan/80">
                Open workspace
                <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
              <div
                className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-60"
                style={{ background: "var(--gradient-core)" }}
              />
            </Link>
          </motion.div>
        ))}
      </div>

      <Panel delay={0.4} className="mt-4">
        <h2 className="text-sm font-semibold">Ensemble comparison</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                {["Model", "Accuracy", "Precision", "Recall", "F1", "PR AUC", "Latency"].map((h) => (
                  <th key={h} className="pb-3 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODELS.map((m) => (
                <tr key={m.id} className="border-t border-white/6">
                  <td className="py-3 font-medium">{m.name}</td>
                  <td className="tabular-nums">{(m.accuracy * 100).toFixed(1)}%</td>
                  <td className="tabular-nums">{(m.precision * 100).toFixed(1)}%</td>
                  <td className="tabular-nums">{(m.recall * 100).toFixed(1)}%</td>
                  <td className="tabular-nums">{(m.f1 * 100).toFixed(1)}%</td>
                  <td className="tabular-nums">{m.prAuc.toFixed(3)}</td>
                  <td className="tabular-nums text-cyan">{m.latencyMs} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </ModuleShell>
  );
}
