import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { ModuleShell, PageHeader, Panel } from "@/components/ui-kit";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MODELS } from "@/lib/platform-data";

export const Route = createFileRoute("/models/")({
  head: () => ({
    meta: [
      { title: "Models — Aegis" },
      {
        name: "description",
        content:
          "The production fraud-detection ensemble: LightGBM, XGBoost, Random Forest, Logistic Regression, MLP and TabNet, with full metrics.",
      },
      { property: "og:title", content: "Models — Aegis" },
      {
        property: "og:description",
        content:
          "Explore architecture, metrics and inference speed for each model in the ensemble.",
      },
    ],
  }),
  component: Models,
});

const COLUMNS = [
  { key: "prAuc", label: "PR AUC", format: (m: (typeof MODELS)[number]) => m.prAuc.toFixed(3) },
  { key: "rocAuc", label: "ROC AUC", format: (m: (typeof MODELS)[number]) => m.rocAuc.toFixed(3) },
  {
    key: "precision",
    label: "Precision",
    format: (m: (typeof MODELS)[number]) => `${(m.precision * 100).toFixed(1)}%`,
  },
  {
    key: "recall",
    label: "Recall",
    format: (m: (typeof MODELS)[number]) => `${(m.recall * 100).toFixed(1)}%`,
  },
  { key: "f1", label: "F1", format: (m: (typeof MODELS)[number]) => `${(m.f1 * 100).toFixed(1)}%` },
] as const;

/**
 * One table, not a card grid plus a table underneath it. The page previously
 * showed every model twice -- six cards carrying three metrics each, then a
 * comparison table carrying seven -- which is duplication rather than
 * hierarchy. Comparing six models across six metrics is a table's job, and
 * the model name is the link into its workspace.
 */
function Models() {
  return (
    <ModuleShell>
      <PageHeader
        title="Models"
        description="Stored evaluation results for the ensemble. These are historical measurements, not live predictions — run a transaction on Investigate for that."
      />

      <Panel className="p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[760px] text-sm">
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="h-auto px-5 py-2.5 text-xs font-medium text-muted-foreground">
                  Model
                </TableHead>
                {COLUMNS.map((c) => (
                  <TableHead
                    key={c.key}
                    className="h-auto px-4 py-2.5 text-right text-xs font-medium text-muted-foreground"
                  >
                    {c.label}
                  </TableHead>
                ))}
                <TableHead className="h-auto px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">
                  Latency
                </TableHead>
                <TableHead className="h-auto w-8 px-2 py-2.5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {MODELS.map((m) => (
                <TableRow key={m.id} className="border-border">
                  <TableCell className="px-5 py-3">
                    <Link to="/models/$modelId" params={{ modelId: m.id }} className="group block">
                      <div className="font-medium transition group-hover:text-primary">
                        {m.name}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{m.family}</div>
                    </Link>
                  </TableCell>
                  {COLUMNS.map((c) => (
                    <TableCell key={c.key} className="px-4 py-3 text-right tabular-nums">
                      {c.format(m)}
                    </TableCell>
                  ))}
                  <TableCell className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {m.latencyMs} ms
                  </TableCell>
                  <TableCell className="px-2 py-3">
                    <Link
                      to="/models/$modelId"
                      params={{ modelId: m.id }}
                      aria-label={`Open ${m.name}`}
                      className="grid h-6 w-6 place-items-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Latency figures are stored estimates for a single prediction, not measurements taken from
        this deployment.
      </p>
    </ModuleShell>
  );
}
