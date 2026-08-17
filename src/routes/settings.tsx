import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { ModuleShell, PageHeader, Panel } from "@/components/ui-kit";
import { MODELS } from "@/lib/platform-data";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Aegis" },
      {
        name: "description",
        content: "Local display preferences for the Aegis fraud detection platform: risk threshold and ensemble membership shown in the UI.",
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
        eyebrow="Settings"
        title="Tune the command center."
        description="Local display preferences, saved to this browser. These do not change the backend's scoring path — the ensemble that scores every transaction is fixed server-side."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="text-sm font-semibold">Chain data feed</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            The live-monitor feed's Etherscan key lives in the backend's <code className="font-mono">.env</code> and is
            read by <code className="font-mono">tools/live_ingest_etherscan.py</code> — it isn't editable from this
            page.
          </p>
        </Panel>

        <Panel delay={0.08}>
          <h2 className="text-sm font-semibold">High-risk threshold</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            Local display cutoff only — used where a backend verdict isn't available (e.g. the
            simulated states on Live Monitor). Saved to this browser.
          </p>
          <div className="mt-7 flex items-center gap-5">
            <input
              type="range"
              min={30}
              max={95}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="h-1.5 w-full appearance-none rounded-full bg-white/10 accent-cyan"
            />
            <span className="font-display text-2xl font-semibold tabular-nums text-cyan">
              {threshold}
            </span>
          </div>
        </Panel>

        <Panel delay={0.14} className="lg:col-span-2">
          <h2 className="text-sm font-semibold">Ensemble membership</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            Local display preference for the Models page. Saved to this browser — the backend always
            scores with all {MODELS.length} models regardless of this setting.
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {MODELS.map((m) => {
              const on = active.includes(m.id);
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-[#0e1832] px-4 py-3"
                >
                  <div>
                    <div className="text-xs font-medium">{m.name}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {m.latencyMs} ms
                    </div>
                  </div>
                  <Switch
                    checked={on}
                    onCheckedChange={(v) =>
                      setActive((prev) => (v ? [...prev, m.id] : prev.filter((x) => x !== m.id)))
                    }
                  />
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </ModuleShell>
  );
}
