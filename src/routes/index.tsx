import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { ArrowUpRight, Command, ShieldCheck, Zap } from "lucide-react";
import { AiCore } from "@/components/ai-core";
import { NAV } from "@/components/nav-dock";
import { MODELS } from "@/lib/platform-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aegis — AI Ethereum Fraud Detection Command Center" },
      {
        name: "description",
        content:
          "Aegis monitors Ethereum in real time and scores every transaction with a seven-model AI consensus engine, SHAP explainability and instant risk reporting.",
      },
      { property: "og:title", content: "Aegis — AI Ethereum Fraud Detection Command Center" },
      {
        property: "og:description",
        content:
          "Real-time Ethereum monitoring with a seven-model AI consensus engine, explainable risk scoring and enterprise reporting.",
      },
    ],
  }),
  component: Landing,
});

const CAPABILITIES = [
  {
    title: "Real-time chain telemetry",
    body: "Every block, every transfer, streamed and scored the moment it is mined. Risk surfaces before finality.",
    icon: Zap,
  },
  {
    title: "Seven models, one verdict",
    body: "Gradient boosting, deep tabular transformers and linear baselines vote inside the Consensus Engine.",
    icon: ShieldCheck,
  },
  {
    title: "Explainable by construction",
    body: "SHAP attributions and natural-language reasoning accompany every single prediction we emit.",
    icon: Command,
  },
];

function Landing() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const coreScale = useTransform(scrollYProgress, [0, 1], [1, 1.35]);
  const coreOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const titleY = useTransform(scrollYProgress, [0, 1], [0, -140]);

  return (
    <main className="relative">
      <section ref={ref} className="relative flex min-h-[100svh] flex-col items-center justify-center px-5">
        <motion.div
          style={{ scale: coreScale, opacity: coreOpacity }}
          className="pointer-events-none absolute inset-0 grid place-items-center"
        >
          <AiCore scale={1.15} />
        </motion.div>

        <motion.div style={{ y: titleY }} className="relative z-10 max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mx-auto inline-flex items-center gap-2 rounded-full glass-soft px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-cyan/85"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-safe" />
            Core online · 7 models synced
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 26, filter: "blur(14px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            className="mt-7 text-balance text-5xl font-semibold leading-[0.95] sm:text-7xl lg:text-[5.4rem]"
          >
            The intelligence layer for <span className="text-gradient">Ethereum trust</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.9 }}
            className="mx-auto mt-7 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-base"
          >
            Aegis watches the chain, reasons about intent, and tells you why. A command center for
            fraud detection — not a dashboard.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-3"
          >
            <Link
              to="/monitor"
              className="group inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:scale-[1.03] hover:shadow-[0_18px_50px_-16px_var(--signal-green)]"
            >
              Enter the command center
              <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            <Link
              to="/consensus"
              className="inline-flex items-center gap-2 rounded-full glass-soft px-6 py-3 text-sm font-medium transition hover:scale-[1.03] hover:bg-white/8"
            >
              See the consensus engine
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-14 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4"
          >
            {[
              ["98.7%", "Peak accuracy"],
              ["4 ms", "Median inference"],
              ["18.9M", "Txns scored"],
              ["7", "Ensemble models"],
            ].map(([v, l]) => (
              <div key={l}>
                <div className="font-display text-2xl font-semibold tabular-nums">{v}</div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  {l}
                </div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-[1400px] px-5 pb-28 sm:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {CAPABILITIES.map((c, i) => (
            <motion.article
              key={c.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: i * 0.12, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -6 }}
              className="rounded-3xl glass-panel p-7"
            >
              <c.icon className="h-5 w-5 text-cyan" strokeWidth={1.6} />
              <h2 className="mt-6 text-lg font-semibold">{c.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{c.body}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-5 pb-28 sm:px-8">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-xl text-3xl font-semibold sm:text-4xl"
        >
          Eleven workspaces. One continuous surface.
        </motion.h2>
        <p className="mt-4 max-w-lg text-sm text-muted-foreground">
          Switching never reloads a page — the workspace morphs around you. Press{" "}
          <kbd className="rounded-md border border-white/12 px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>{" "}
          anywhere.
        </p>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {NAV.filter((n) => n.to !== "/").map((n, i) => (
            <motion.div
              key={n.to}
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.05 }}
            >
              <Link
                to={n.to}
                className="group flex h-full items-center gap-3 rounded-2xl glass-soft p-5 transition hover:-translate-y-1 hover:bg-white/8"
              >
                <n.icon className="h-4 w-4 text-electric" strokeWidth={1.7} />
                <span className="text-sm font-medium">{n.label}</span>
                <ArrowUpRight className="ml-auto h-3.5 w-3.5 opacity-0 transition group-hover:opacity-60" />
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-5 pb-48 sm:px-8">
        <div className="rounded-[2rem] glass-panel p-8 sm:p-12">
          <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan/80">
            The ensemble
          </p>
          <h2 className="mt-4 max-w-xl text-3xl font-semibold sm:text-4xl">
            Seven independent minds, cross-examined in 42 ms.
          </h2>
          <div className="mt-10 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {MODELS.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
              >
                <Link
                  to="/models/$modelId"
                  params={{ modelId: m.id }}
                  className="group block rounded-2xl border border-white/8 bg-white/3 p-5 transition hover:-translate-y-1 hover:border-cyan/30"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-display text-base font-semibold">{m.name}</span>
                    <span className="font-mono text-[11px] text-safe tabular-nums">
                      {(m.accuracy * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{m.tagline}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
