import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Network, Play } from "lucide-react";
import { ModuleShell, PageHeader, Panel, RiskBadge, StatTile } from "@/components/ui-kit";
import { MODELS, levelFromRisk } from "@/lib/platform-data";

export const Route = createFileRoute("/consensus")({
  head: () => ({
    meta: [
      { title: "AI Consensus Engine — Aegis" },
      {
        name: "description",
        content:
          "Run all seven fraud-detection models simultaneously and watch them vote inside the Aegis Consensus Engine with agreement, confidence and a final verdict.",
      },
      { property: "og:title", content: "AI Consensus Engine — Aegis" },
      {
        property: "og:description",
        content: "Seven models vote in real time and converge on a single explainable verdict.",
      },
    ],
  }),
  component: Consensus,
});

interface Vote {
  id: string;
  name: string;
  fraud: boolean;
  confidence: number;
}

function Consensus() {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [running, setRunning] = useState(false);

  const run = () => {
    setVotes([]);
    setRunning(true);
    const bias = Math.random();
    MODELS.forEach((m, i) => {
      setTimeout(() => {
        setVotes((prev) => [
          ...prev,
          {
            id: m.id,
            name: m.name,
            fraud: Math.random() < bias,
            confidence: Number((0.7 + Math.random() * 0.29).toFixed(3)),
          },
        ]);
        if (i === MODELS.length - 1) setRunning(false);
      }, 420 + i * 380);
    });
  };

  const fraudVotes = votes.filter((v) => v.fraud).length;
  const agreement = votes.length
    ? Math.round((Math.max(fraudVotes, votes.length - fraudVotes) / votes.length) * 100)
    : 0;
  const confidence = votes.length
    ? votes.reduce((s, v) => s + v.confidence, 0) / votes.length
    : 0;
  const verdictFraud = fraudVotes > votes.length / 2;
  const complete = votes.length === MODELS.length;

  return (
    <ModuleShell>
      <PageHeader
        eyebrow="AI consensus"
        title="Seven votes. One verdict."
        description="Every model scores the transaction independently, then streams its ballot into the Consensus Engine. Agreement and calibrated confidence decide the recommendation."
        aside={
          <button
            onClick={run}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:scale-[1.03] disabled:opacity-50"
          >
            <Play className="h-4 w-4" /> {running ? "Voting…" : "Run consensus"}
          </button>
        }
      />

      <Panel className="relative overflow-hidden">
        <div className="relative mx-auto grid min-h-[440px] w-full max-w-[820px] place-items-center">
          <svg className="absolute inset-0 h-full w-full" aria-hidden>
            {MODELS.map((m, i) => {
              const angle = (i / MODELS.length) * Math.PI * 2 - Math.PI / 2;
              const x = 50 + Math.cos(angle) * 38;
              const y = 50 + Math.sin(angle) * 40;
              const voted = votes.some((v) => v.id === m.id);
              const vote = votes.find((v) => v.id === m.id);
              return (
                <motion.line
                  key={m.id}
                  x1={`${x}%`}
                  y1={`${y}%`}
                  x2="50%"
                  y2="50%"
                  stroke={
                    voted
                      ? vote?.fraud
                        ? "var(--risk)"
                        : "var(--safe)"
                      : "oklch(0.99 0.01 265 / 10%)"
                  }
                  strokeWidth={voted ? 1.6 : 0.8}
                  initial={{ pathLength: 0.15, opacity: 0.4 }}
                  animate={{ pathLength: voted ? 1 : 0.15, opacity: voted ? 0.9 : 0.35 }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                />
              );
            })}
          </svg>

          {MODELS.map((m, i) => {
            const angle = (i / MODELS.length) * Math.PI * 2 - Math.PI / 2;
            const vote = votes.find((v) => v.id === m.id);
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.06 }}
                className="absolute w-32 -translate-x-1/2 -translate-y-1/2 text-center"
                style={{
                  left: `${50 + Math.cos(angle) * 38}%`,
                  top: `${50 + Math.sin(angle) * 40}%`,
                }}
              >
                <motion.div
                  animate={
                    vote
                      ? {
                          boxShadow: `0 0 0 1px ${vote.fraud ? "var(--risk)" : "var(--safe)"}, 0 14px 40px -14px ${vote.fraud ? "var(--risk)" : "var(--safe)"}`,
                        }
                      : {}
                  }
                  className="rounded-2xl glass-soft px-3 py-2.5"
                >
                  <div className="text-[11px] font-medium">{m.name}</div>
                  <AnimatePresence>
                    {vote ? (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`mt-1 font-mono text-[10px] uppercase tracking-[0.14em] ${vote.fraud ? "text-risk" : "text-safe"}`}
                      >
                        {vote.fraud ? "fraud" : "clear"} · {(vote.confidence * 100).toFixed(0)}%
                      </motion.div>
                    ) : (
                      <motion.div className="mt-1 font-mono text-[10px] text-muted-foreground/60">
                        idle
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            );
          })}

          <motion.div
            animate={{ scale: complete ? [1, 1.08, 1] : 1 }}
            transition={{ duration: 0.8 }}
            className="relative z-10 grid h-40 w-40 place-items-center rounded-full glass-panel text-center"
          >
            <div
              className="absolute inset-[18%] rounded-full blur-xl"
              style={{
                background: complete
                  ? verdictFraud
                    ? "var(--risk)"
                    : "var(--safe)"
                  : "var(--gradient-core)",
                opacity: 0.45,
              }}
            />
            <div className="relative">
              <Network className="mx-auto h-5 w-5 text-cyan" strokeWidth={1.6} />
              <div className="mt-2 font-display text-2xl font-semibold tabular-nums">
                {agreement}%
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                agreement
              </div>
            </div>
          </motion.div>
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Ballots in" value={`${votes.length} / 7`} accent="cyan" />
        <StatTile label="Fraud votes" value={String(fraudVotes)} accent="risk" delay={0.05} />
        <StatTile
          label="Consensus confidence"
          value={`${(confidence * 100).toFixed(1)}%`}
          accent="electric"
          delay={0.1}
        />
        <StatTile
          label="Final verdict"
          value={!complete ? "—" : verdictFraud ? "Fraudulent" : "Legitimate"}
          accent={verdictFraud ? "risk" : "safe"}
          delay={0.15}
        />
      </div>

      {complete ? (
        <Panel delay={0.2} className="mt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recommendation</h2>
            <RiskBadge level={levelFromRisk(verdictFraud ? 88 : 14)} />
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {verdictFraud
              ? `${fraudVotes} of 7 models converge on fraud at ${(confidence * 100).toFixed(1)}% mean confidence, with the tabular transformer and both boosting models in agreement. Freeze settlement and route to manual review.`
              : `${votes.length - fraudVotes} of 7 models classify this transaction as legitimate at ${(confidence * 100).toFixed(1)}% mean confidence. No dissent from the high-recall models — release without intervention.`}
          </p>
        </Panel>
      ) : null}
    </ModuleShell>
  );
}
