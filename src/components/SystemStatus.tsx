import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, CircleHelp, XCircle } from "lucide-react";
import { Panel, SectionHeading } from "@/components/ui-kit";
import { MODELS } from "@/lib/platform-data";
import { API_BASE_URL } from "@/lib/api";

type State = "operational" | "degraded" | "offline" | "unknown" | "checking";

const META: Record<State, { label: string; icon: typeof CheckCircle2; className: string }> = {
  operational: { label: "Operational", icon: CheckCircle2, className: "text-safe" },
  degraded: { label: "Degraded", icon: CircleAlert, className: "text-warn" },
  offline: { label: "Offline", icon: XCircle, className: "text-risk" },
  unknown: { label: "Unknown", icon: CircleHelp, className: "text-muted-foreground" },
  checking: { label: "Checking…", icon: CircleHelp, className: "text-muted-foreground" },
};

function Row({ label, state, sub }: { label: string; state: State; sub?: string | undefined }) {
  const m = META[state];
  const Icon = m.icon;
  return (
    <div className="flex items-center justify-between gap-3 rounded-md card-flat px-4 py-3.5">
      <div>
        <div className="text-xs font-medium">{label}</div>
        {sub ? (
          <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{sub}</div>
        ) : null}
      </div>
      <div
        className={`flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider ${m.className}`}
      >
        <Icon className="h-3.5 w-3.5" /> {m.label}
      </div>
    </div>
  );
}

// Every state below is a REAL check, not a hardcoded "operational" for
// appearance: /health is actually called, model presence comes from that
// response's real available_models list, and the live-stream socket is
// actually opened and its result observed. Etherscan reachability has no
// existing backend check to call, so it stays UNKNOWN rather than guessed.
export function SystemStatus() {
  const [apiState, setApiState] = useState<State>("checking");
  const [modelsLoaded, setModelsLoaded] = useState<number | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [unavailable, setUnavailable] = useState<Record<string, string>>({});
  const [wsState, setWsState] = useState<State>("checking");

  useEffect(() => {
    fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(5000) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        setApiState("operational");
        setModelsLoaded(d.models_loaded ?? 0);
        setAvailableModels(d.available_models ?? []);
        setUnavailable(d.unavailable_models ?? {});
      })
      .catch(() => setApiState("offline"));

    let settled = false;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(`${API_BASE_URL.replace("http", "ws")}/api/v1/stream/live`);
      const timer = window.setTimeout(() => {
        if (!settled) {
          settled = true;
          setWsState("offline");
          ws?.close();
        }
      }, 5000);
      ws.onopen = () => {
        settled = true;
        window.clearTimeout(timer);
        setWsState("operational");
      };
      ws.onerror = () => {
        settled = true;
        window.clearTimeout(timer);
        setWsState("offline");
      };
    } catch {
      setWsState("offline");
    }
    return () => ws?.close();
  }, []);

  const mlState: State =
    modelsLoaded === null
      ? "checking"
      : modelsLoaded >= MODELS.length
        ? "operational"
        : modelsLoaded > 0
          ? "degraded"
          : "offline";

  // Services and models on one page. They were split across two tabs, so
  // confirming the app was healthy meant checking two places -- which is the
  // opposite of what a status page is for.
  return (
    <div className="space-y-4">
      <Panel>
        <SectionHeading title="Core services" />
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Row label="API" state={apiState} sub={API_BASE_URL} />
          <Row
            label="ML engine"
            state={mlState}
            sub={
              modelsLoaded === null
                ? undefined
                : `${modelsLoaded} / ${MODELS.length} models serving`
            }
          />
          <Row
            label="Live stream socket"
            state={wsState}
            sub="Connection only — live data needs tools/live_ingest_etherscan.py running"
          />
          <Row
            label="Etherscan reachability"
            state="unknown"
            sub="No backend health check exists for this yet"
          />
        </div>
      </Panel>

      <Panel>
        <SectionHeading
          title="Models"
          hint="A model the backend is deliberately holding back reports the reason it gave."
        />
        <div className="mt-4 divide-y divide-border">
          {MODELS.map((m) => {
            const backendId = m.id.replace(/-/g, "_");
            const present = availableModels.includes(backendId);
            const state: State =
              apiState === "checking"
                ? "checking"
                : apiState === "offline"
                  ? "unknown"
                  : present
                    ? "operational"
                    : "offline";
            // The backend now explains why it withheld a model rather than
            // leaving an unexplained gap -- a model held back because its
            // paired scaler is unknown is a very different situation from a
            // missing file, and only one of them is fixable by restarting.
            const reason = unavailable[backendId];
            return (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5"
              >
                <span className="text-sm font-medium">{m.name}</span>
                <StateLabel state={state} />
                {reason ? (
                  <p className="w-full text-xs leading-relaxed text-muted-foreground">{reason}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function StateLabel({ state }: { state: State }) {
  const m = META[state];
  const Icon = m.icon;
  return (
    <span
      className={`flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider ${m.className}`}
    >
      <Icon className="h-3.5 w-3.5" /> {m.label}
    </span>
  );
}
