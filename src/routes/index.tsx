import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { ArrowUpRight, Command, ShieldCheck, Zap } from "lucide-react";
import { AiCore } from "@/components/ai-core";
import { MODELS } from "@/lib/platform-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aegis — AI Ethereum Fraud Detection Command Center" },
      {
        name: "description",
        content:
          "Aegis monitors Ethereum in real time and scores every transaction with a six-model AI consensus engine, feature attribution and instant risk reporting.",
      },
      { property: "og:title", content: "Aegis — AI Ethereum Fraud Detection Command Center" },
      {
        property: "og:description",
        content:
          "Real-time Ethereum monitoring with a six-model AI consensus engine, explainable risk scoring and enterprise reporting.",
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
    title: "Six models, one verdict",
    body: "Gradient boosting, an attentive tabular network and linear baselines vote inside the Consensus Engine.",
    icon: ShieldCheck,
  },
  {
    title: "Explainable by construction",
    body: "Feature attribution and a recommended action accompany every single prediction we emit.",
    icon: Command,
  },
];

const HOW_IT_WORKS = [
  { step: "01", label: "Enter a transaction", body: "Paste a hash or enter from/to/value/gas directly." },
  { step: "02", label: "Look up wallet data", body: "A live per-wallet token lookup runs against Etherscan." },
  { step: "03", label: "Derive features", body: "The raw transaction becomes a 61-feature vector." },
  { step: "04", label: "Score the ensemble", body: "All six production models score the vector independently." },
  { step: "05", label: "Compute consensus", body: "Votes are combined into one risk score and agreement figure." },
  { step: "06", label: "Verdict & action", body: "A verdict, feature attribution and a recommended action ship together." },
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
            Core online · 6 models synced
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
            Aegis watches the chain, reasons about intent, and tells you why. An investigation
            platform for Ethereum fraud — not a dashboard.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-3"
          >
            <Link
              to="/detect"
              className="group inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:scale-[1.03] hover:shadow-[0_18px_50px_-16px_var(--signal-green)]"
            >
              Analyze a transaction
              <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            <Link
              to="/monitor"
              className="inline-flex items-center gap-2 rounded-full glass-soft px-6 py-3 text-sm font-medium transition hover:scale-[1.03] hover:bg-white/8"
            >
              Watch the live feed
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-14 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4"
          >
            {[
              ["0.9656", "Peak ROC-AUC"],
              ["0.3 ms", "Min inference"],
              ["1.02M", "Dataset rows"],
              [String(MODELS.length), "Ensemble models"],
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
          One investigation, start to finish.
        </motion.h2>
        <p className="mt-4 max-w-lg text-sm text-muted-foreground">
          Every transaction that reaches Aegis moves through the same six steps, on one screen.
        </p>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {HOW_IT_WORKS.map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.06 }}
              className="rounded-2xl glass-soft p-5"
            >
              <span className="font-mono text-[11px] text-cyan/80">{s.step}</span>
              <div className="mt-2 text-sm font-medium">{s.label}</div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
            </motion.div>
          ))}
        </div>
        <Link
          to="/detect"
          className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-cyan hover:text-cyan/80"
        >
          Try it now <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </section>
    </main>
  );
}
