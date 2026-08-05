import { createFileRoute } from "@tanstack/react-router";
import { FileText, Table2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ModuleShell, PageHeader, Panel, StatTile } from "@/components/ui-kit";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Aegis" },
      {
        name: "description",
        content:
          "Generate professional PDF and CSV fraud-detection reports, prediction summaries and batch summaries from the Aegis platform.",
      },
      { property: "og:title", content: "Reports — Aegis" },
      {
        property: "og:description",
        content: "Audit-ready prediction and batch reports in PDF or CSV.",
      },
    ],
  }),
  component: Reports,
});

const TEMPLATES = [
  {
    title: "Prediction summary",
    body: "Single-transaction dossier: verdict, confidence, SHAP attribution and recommended action.",
    icon: Sparkles,
  },
  {
    title: "Batch summary",
    body: "Aggregate CSV run: distribution, flagged rows, per-model agreement and reviewer queue.",
    icon: Table2,
  },
  {
    title: "Compliance pack",
    body: "Regulator-formatted narrative with model cards, metrics and decision-path evidence.",
    icon: FileText,
  },
];

function Reports() {
  return (
    <ModuleShell>
      <PageHeader
        eyebrow="Reports"
        title="Evidence, formatted for humans."
        description="Every analysis can be lifted into an audit-ready document — typeset, timestamped and signed with the exact model versions that produced the verdict."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Reports generated" value="2,148" accent="cyan" />
        <StatTile label="Avg. build time" value="1.8 s" delay={0.05} />
        <StatTile label="Retention" value="7 years" accent="violet" delay={0.1} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {TEMPLATES.map((t, i) => (
          <Panel key={t.title} delay={0.1 + i * 0.07} tilt>
            <t.icon className="h-5 w-5 text-cyan" strokeWidth={1.6} />
            <h2 className="mt-6 text-lg font-semibold">{t.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t.body}</p>
            <div className="mt-7 flex gap-2">
              <button
                onClick={() => toast.success(`${t.title} · PDF generated`)}
                className="flex-1 rounded-xl bg-foreground px-4 py-2.5 text-xs font-medium text-background transition hover:scale-[1.02]"
              >
                PDF
              </button>
              <button
                onClick={() => toast.success(`${t.title} · CSV generated`)}
                className="flex-1 rounded-xl glass-soft px-4 py-2.5 text-xs font-medium transition hover:bg-white/10"
              >
                CSV
              </button>
            </div>
          </Panel>
        ))}
      </div>
    </ModuleShell>
  );
}
