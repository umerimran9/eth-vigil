import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Box, Radar, ShieldCheck, Sparkles, Activity, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNetworkState } from "@/lib/network-state";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aegis — Read Ethereum Before It Costs You" },
      {
        name: "description",
        content:
          "Aegis watches Ethereum in real time and explains each transaction in plain language: seven models, one verdict, full evidence trail.",
      },
      { property: "og:title", content: "Aegis — Read Ethereum Before It Costs You" },
      {
        property: "og:description",
        content:
          "Real-time Ethereum monitoring with explainable AI verdicts on every transaction, wallet, and contract.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const NAV_LINKS = [
  { label: "Overview", to: "/dashboard" },
  { label: "Live stream", to: "/monitor" },
  { label: "Investigate", to: "/detect" },
  { label: "Models", to: "/models" },
  { label: "Analytics", to: "/analytics" },
];

const SAMPLES = [
  "Drainer approval",
  "Sanctioned bridge hop",
  "Flash-loan probe",
  "Mixer withdrawal",
  "Rug-pull mint",
];

function PillNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="sticky top-4 z-30 flex justify-center px-4">
      <nav
        className={cn(
          "pill-nav flex w-full max-w-4xl items-center gap-2 rounded-full px-3 py-2 transition-all duration-500",
          scrolled ? "max-w-3xl py-1.5" : "",
        )}
      >
        <Link to="/" className="nav-pill-item group flex items-center gap-2 rounded-full px-2 py-1.5">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground transition-transform duration-300 group-hover:rotate-12">
            <Box className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-foreground">Aegis</span>
        </Link>

        <ul className="ml-2 hidden items-center gap-0.5 md:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.to}>
              <Link
                to={l.to}
                className="nav-pill-item block rounded-full px-3 py-1.5 text-[13px] text-foreground/70 hover:bg-foreground/10 hover:text-foreground"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <Link
          to="/dashboard"
          className="lift ml-auto inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-[13px] font-semibold text-background hover:shadow-[0_12px_28px_-12px_rgba(139,92,246,0.9)]"
        >
          Open dashboard
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
        </Link>
      </nav>
    </div>
  );
}

function Landing() {
  const net = useNetworkState();
  const navigate = useNavigate();
  const [hash, setHash] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = hash.trim();
    if (!q) {
      navigate({ to: "/dashboard" });
      return;
    }
    navigate({ to: "/detect", search: { hash: q, aegisRun: true } });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="hero-field pb-24">
        <PillNav />

        <header className="mx-auto max-w-3xl px-5 pt-20 text-center sm:pt-28">
          <div className="rise inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-foreground/5 px-3 py-1 text-[11px] text-foreground/80 backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-safe" />
            Watching mainnet · head {net.blockLabel} · {net.baseFeeGwei.toFixed(1)} gwei
          </div>

          <h1
            className="rise mt-7 font-display text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-6xl"
            style={{ animationDelay: "80ms" }}
          >
            Read Ethereum before
            <br />
            it costs you money.
          </h1>

          <p
            className="rise mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-foreground/70"
            style={{ animationDelay: "160ms" }}
          >
            Paste a transaction, wallet, or contract. Seven models score it, argue, and hand you one
            verdict with the evidence written out in plain English.
          </p>

          <form
            onSubmit={submit}
            className="rise mx-auto mt-9 flex max-w-xl items-center gap-2 rounded-full border border-foreground/15 bg-foreground/[0.06] p-1.5 backdrop-blur transition-all duration-300 focus-within:border-primary/60 focus-within:bg-foreground/10"
            style={{ animationDelay: "240ms" }}
          >
            <input
              value={hash}
              onChange={(e) => setHash(e.target.value)}
              placeholder="0x… transaction hash, wallet or contract"
              aria-label="Transaction hash, wallet or contract address"
              className="min-w-0 flex-1 bg-transparent px-4 font-mono text-[13px] text-foreground placeholder:text-foreground/40 focus:outline-none"
            />
            <button
              type="submit"
              className="lift inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground hover:shadow-[0_14px_30px_-12px_rgba(139,92,246,1)]"
            >
              Analyse
              <Sparkles className="h-3.5 w-3.5" />
            </button>
          </form>

          <ul
            className="rise mt-6 flex flex-wrap justify-center gap-2"
            style={{ animationDelay: "320ms" }}
          >
            {SAMPLES.map((s) => (
              <li key={s}>
                <Link
                  to="/detect"
                  className="lift block rounded-full border border-foreground/12 bg-foreground/5 px-3.5 py-1.5 text-[12px] text-foreground/75 hover:border-primary/50 hover:text-foreground"
                >
                  {s}
                </Link>
              </li>
            ))}
          </ul>
        </header>
      </div>

      <section className="mx-auto -mt-14 grid w-full max-w-5xl gap-4 px-5 sm:grid-cols-3">
        {[
          {
            icon: Activity,
            title: "Never blinks",
            body: "Every block streamed and scored as it lands — no polling, no gaps in the record.",
          },
          {
            icon: Brain,
            title: "Seven opinions",
            body: "Gradient boosting, forests and transformers vote. Disagreement is shown, not hidden.",
          },
          {
            icon: ShieldCheck,
            title: "Evidence, not vibes",
            body: "Each verdict ships with attribution, the flow path, and an audit-ready report.",
          },
        ].map((f, i) => (
          <article
            key={f.title}
            className="card-flat lift rise rounded-2xl p-5"
            style={{ animationDelay: `${400 + i * 80}ms` }}
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
              <f.icon className="h-4.5 w-4.5" />
            </span>
            <h2 className="mt-4 font-display text-base font-semibold tracking-tight">{f.title}</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{f.body}</p>
          </article>
        ))}
      </section>

      <section className="mx-auto mt-20 max-w-5xl px-5 pb-24">
        <div className="card-flat flex flex-col items-start justify-between gap-5 rounded-2xl p-7 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight">
              The whole terminal is one click away.
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Live stream, batch scanner, case history, model workspaces and audit reports.
            </p>
          </div>
          <Link
            to="/dashboard"
            className="lift inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:shadow-[0_16px_34px_-14px_rgba(139,92,246,1)]"
          >
            <Radar className="h-4 w-4" />
            Enter dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
