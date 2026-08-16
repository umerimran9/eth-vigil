import { useEffect, useState, useSyncExternalStore } from "react";
import { levelFromVerdict, type RiskLevel, type Txn } from "@/lib/platform-data";
import { WS_BASE_URL } from "@/lib/api";

export type WsStatus = "connecting" | "connected" | "waiting" | "disconnected";

export interface ModelScoreEntry {
  probability: number;
  threshold: number;
  verdict: string;
}

export interface LiveTxn extends Txn {
  modelScores?: Record<string, ModelScoreEntry>;
  featuresDefaulted?: boolean;
}

interface StreamState {
  block: number | null;
  recentBlocks: number[];
  txns: LiveTxn[];
  wsStatus: WsStatus;
  live: boolean;
}

let state: StreamState = {
  block: null,
  recentBlocks: [],
  txns: [],
  wsStatus: "connecting",
  live: true,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

let ws: WebSocket | null = null;
let waitTimer: number | null = null;
let reconnectTimer: number | null = null;

function armWaitTimer() {
  if (waitTimer) window.clearTimeout(waitTimer);
  waitTimer = window.setTimeout(() => {
    if (state.wsStatus === "connected") {
      state = { ...state, wsStatus: "waiting" };
      notify();
    }
  }, 20000);
}

export function startGlobalStream() {
  if (!state.live || (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING))) {
    return;
  }

  state = { ...state, wsStatus: "connecting" };
  notify();

  try {
    ws = new WebSocket(`${WS_BASE_URL}/api/v1/stream/live`);

    ws.onopen = () => {
      state = { ...state, wsStatus: "connected" };
      notify();
      armWaitTimer();
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload && payload.hash) {
          armWaitTimer();
          const riskVal = (payload.risk_score || 0) * 100;
          const newTx: LiveTxn = {
            hash: payload.hash,
            from: payload.from_address || "0x0000...",
            to: payload.to_address || "0x0000...",
            value: payload.value_eth || 0,
            gas: payload.gas || 21000,
            block: payload.block_number || 0,
            risk: Number(riskVal.toFixed(1)),
            level: levelFromVerdict(payload.verdict, riskVal),
            ts: Date.now(),
            modelScores:
              payload.model_scores && typeof payload.model_scores === "object" ? payload.model_scores : undefined,
            featuresDefaulted: Boolean(payload.features_defaulted),
          };

          let newRecent = state.recentBlocks;
          let newBlock = state.block;
          if (payload.block_number) {
            newBlock = payload.block_number;
            if (state.recentBlocks[0] !== payload.block_number) {
              newRecent = [payload.block_number, ...state.recentBlocks].slice(0, 5);
            }
          }

          // Deduplicate by hash and keep latest 50
          const existingIndex = state.txns.findIndex((t) => t.hash === newTx.hash);
          let newTxns = state.txns;
          if (existingIndex >= 0) {
            newTxns = [newTx, ...state.txns.filter((t) => t.hash !== newTx.hash)];
          } else {
            newTxns = [newTx, ...state.txns].slice(0, 50);
          }

          state = {
            ...state,
            block: newBlock,
            recentBlocks: newRecent,
            txns: newTxns,
            wsStatus: "connected",
          };
          notify();
        }
      } catch {
        // ignore malformed frames
      }
    };

    ws.onerror = () => {
      state = { ...state, wsStatus: "disconnected" };
      notify();
    };

    ws.onclose = () => {
      state = { ...state, wsStatus: "disconnected" };
      notify();
      if (state.live) {
        if (reconnectTimer) window.clearTimeout(reconnectTimer);
        reconnectTimer = window.setTimeout(() => startGlobalStream(), 3000);
      }
    };
  } catch {
    state = { ...state, wsStatus: "disconnected" };
    notify();
  }
}

export function stopGlobalStream() {
  if (reconnectTimer) window.clearTimeout(reconnectTimer);
  if (waitTimer) window.clearTimeout(waitTimer);
  if (ws) {
    ws.close();
    ws = null;
  }
  state = { ...state, wsStatus: "disconnected" };
  notify();
}

export function toggleGlobalLive() {
  const nextLive = !state.live;
  state = { ...state, live: nextLive };
  notify();
  if (nextLive) {
    startGlobalStream();
  } else {
    stopGlobalStream();
  }
}

export function setGlobalLive(live: boolean) {
  if (state.live === live) return;
  state = { ...state, live };
  notify();
  if (live) {
    startGlobalStream();
  } else {
    stopGlobalStream();
  }
}

export function useLiveStreamStore() {
  const [snapshot, setSnapshot] = useState(state);

  useEffect(() => {
    const onStoreChange = () => setSnapshot({ ...state });
    listeners.add(onStoreChange);
    // Ensure stream is started
    if (state.live) {
      startGlobalStream();
    }
    return () => {
      listeners.delete(onStoreChange);
    };
  }, []);

  return {
    ...snapshot,
    toggleLive: toggleGlobalLive,
    setLive: setGlobalLive,
  };
}
