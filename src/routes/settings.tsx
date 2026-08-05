import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { ModuleShell, PageHeader, Panel } from "@/components/ui-kit";
import { MODELS } from "@/lib/platform-data";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Aegis" },
      {
        name: "description",
        content:
          "Configure the Ethereum data feed, risk thresholds, active ensemble members and alerting for the Aegis fraud detection platform.",
      },
      { property: "og:title", content: "Settings — Aegis" },
      {
        property: "og:description",
        content: "Tune thresholds, feeds and ensemble membership.",
      },
    ],
  }),
  component: Settings,
});

function Settings() {
  const [threshold, setThreshold] = useState(72);
  const [active, setActive] = useState<string[]>(MODELS.map((m) => m.id));

  return (
    <ModuleShell>
      <PageHeader
        eyebrow="Settings"
        title="Tune the command center."
        description="Feed configuration, decision thresholds and ensemble membership. Changes propagate to the live scoring path immediately."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <h2 className="text-sm font-semibold">Chain data feed</h2>
          <div className="mt-5 space-y-4 text-xs">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Etherscan API key
              </label>
              <input
                type="password"
                defaultValue="••••••••••••••••"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/4 px-4 py-3 font-mono outline-none focus:border-cyan/40"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Poll interval
              </label>
              <input
                defaultValue="1.6s"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/4 px-4 py-3 font-mono outline-none focus:border-cyan/40"
              />
            </div>
          </div>
        </Panel>

        <Panel delay={0.08}>
          <h2 className="text-sm font-semibold">High-risk threshold</h2>
          <p className="mt-2 text-xs text-muted-foreground">
            Scores above this value are escalated to the compliance queue.
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
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {MODELS.map((m) => {
              const on = active.includes(m.id);
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-2xl glass-soft px-4 py-3.5"
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
