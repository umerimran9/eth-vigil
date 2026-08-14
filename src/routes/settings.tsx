import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { ModuleShell, PageHeader, Panel, SectionHeading } from "@/components/ui-kit";
import { MODELS } from "@/lib/platform-data";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Aegis" },
      {
        name: "description",
        content:
          "Local display preferences for the Aegis fraud detection platform: risk threshold and ensemble membership shown in the UI.",
      },
      { property: "og:title", content: "Settings — Aegis" },
      {
        property: "og:description",
        content: "Tune the risk threshold and ensemble membership shown across the UI.",
      },
    ],
  }),
  component: Settings,
});

const THRESHOLD_KEY = "aegis:settings:threshold";
const ACTIVE_MODELS_KEY = "aegis:settings:activeModels";

function Settings() {
  // localStorage doesn't exist during SSR -- render the defaults on the
  // server, then read/apply anything saved once mounted in the browser.
  const [threshold, setThreshold] = useState<number>(72);
  const [active, setActive] = useState<string[]>(() => MODELS.map((m) => m.id));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const savedThreshold = localStorage.getItem(THRESHOLD_KEY);
    if (savedThreshold) setThreshold(Number(savedThreshold));
    const savedActive = localStorage.getItem(ACTIVE_MODELS_KEY);
    if (savedActive) setActive(JSON.parse(savedActive));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(THRESHOLD_KEY, String(threshold));
  }, [hydrated, threshold]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(ACTIVE_MODELS_KEY, JSON.stringify(active));
  }, [hydrated, active]);

  return (
    <ModuleShell>
      <PageHeader
        title="Settings"
        description="Display preferences saved to this browser. None of them change how the backend scores a transaction."
      />

      {/* Three short settings, laid out as a list. They were behind three
          tabs, which hid two of them behind a click each and made the page
          look larger than the two controls it actually contains. */}
      <div className="mx-auto max-w-2xl space-y-3">
        <Panel>
          <SectionHeading
            title="High-risk threshold"
            hint="Display cutoff used only where the backend has not supplied a verdict."
          />
          <div className="mt-5 flex items-center gap-5">
            <input
              type="range"
              min={30}
              max={95}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              aria-label="High-risk threshold"
              className="h-1.5 w-full appearance-none rounded-full bg-accent accent-[var(--brand)]"
            />
            <span className="w-10 shrink-0 text-right text-xl font-semibold tabular-nums">
              {threshold}
            </span>
          </div>
        </Panel>

        <Panel>
          <SectionHeading
            title="Ensemble shown on the Models page"
            hint={`The backend always scores with every available model regardless of this.`}
          />
          <div className="mt-4 divide-y divide-border">
            {MODELS.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-sm">{m.name}</span>
                <Switch
                  checked={active.includes(m.id)}
                  aria-label={m.name}
                  onCheckedChange={(v) =>
                    setActive((prev) => (v ? [...prev, m.id] : prev.filter((x) => x !== m.id)))
                  }
                />
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <SectionHeading title="Chain data feed" />
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The Etherscan key lives in the backend's <code className="font-mono text-xs">.env</code>{" "}
            and is read by <code className="font-mono text-xs">tools/live_ingest_etherscan.py</code>
            . It is not editable here.
          </p>
        </Panel>
      </div>
    </ModuleShell>
  );
}
