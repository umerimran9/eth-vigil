import { useEffect, useState } from "react";

// Persistent Ethereum network context. Mainnet produces a block roughly every
// 12s, so the head advances on that cadence from a known reference height.
// This is presentation-level network identity only -- no chain RPC is claimed.
const REFERENCE_BLOCK = 19485021;
const BLOCK_TIME_MS = 12000;

export interface NetworkState {
  chain: string;
  block: number;
  blockLabel: string;
  secondsIntoBlock: number;
  baseFeeGwei: number;
  healthy: boolean;
}

export const formatBlock = (n: number) => `#${n.toLocaleString("en-US")}`;

export function useNetworkState(): NetworkState {
  const [block, setBlock] = useState(REFERENCE_BLOCK);
  const [tick, setTick] = useState(0);
  const [baseFeeGwei, setBaseFeeGwei] = useState(28.4);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setBlock((b) => b + 1);
      setBaseFeeGwei((f) => {
        const next = f + (Math.random() - 0.5) * 4;
        return Math.min(72, Math.max(9, Number(next.toFixed(1))));
      });
    }, BLOCK_TIME_MS);
    return () => clearInterval(id);
  }, []);

  return {
    chain: "Ethereum Mainnet",
    block,
    blockLabel: formatBlock(block),
    secondsIntoBlock: (tick * 1000) % BLOCK_TIME_MS / 1000,
    baseFeeGwei,
    healthy: true,
  };
}

/** Classify a free-text on-chain query into the entity it most likely names. */
export type OnChainKind = "transaction" | "wallet" | "contract" | "block" | "entity" | "unknown";

export function classifyQuery(raw: string): OnChainKind {
  const q = raw.trim();
  if (!q) return "unknown";
  if (/^0x[0-9a-fA-F]{64}$/.test(q)) return "transaction";
  if (/^0x[0-9a-fA-F]{40}$/.test(q)) return "wallet";
  if (/^0x[0-9a-fA-F]{6,}$/.test(q)) return "transaction";
  if (/\.eth$/i.test(q)) return "entity";
  if (/^[\d,]{4,}$/.test(q)) return "block";
  return "unknown";
}
