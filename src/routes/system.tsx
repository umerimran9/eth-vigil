import { createFileRoute } from "@tanstack/react-router";
import { ModuleShell, PageHeader } from "@/components/ui-kit";
import { SystemStatus } from "@/components/SystemStatus";

export const Route = createFileRoute("/system")({
  head: () => ({
    meta: [
      { title: "System Control Center — Aegis" },
      {
        name: "description",
        content:
          "Real, verified status of the API, the six-model ensemble and the live-stream socket.",
      },
      { property: "og:title", content: "System Control Center — Aegis" },
      { property: "og:description", content: "Live health of Aegis's serving components." },
    ],
  }),
  component: SystemPage,
});

function SystemPage() {
  return (
    <ModuleShell>
      <PageHeader
        eyebrow="System"
        title="System Status"
        description="Every state below is a real, just-performed check — not a hardcoded 'operational' for appearance."
      />
      <SystemStatus />
    </ModuleShell>
  );
}
