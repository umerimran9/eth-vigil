import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/lib/platform-data";

export function Panel({
  children,
  className,
  delay = 0,
  tilt = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  tilt?: boolean;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      {...(tilt
        ? {
            whileHover: { y: -3 },
          }
        : {})}
      className={cn("rounded-xl border border-border bg-card p-6 shadow-sm", className)}
    >
      {children}
    </motion.section>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  aside?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-6 pb-8">
      <div className="max-w-2xl">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-mono text-[11px] uppercase tracking-[0.28em] text-cyan"
        >
          {eyebrow}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl text-foreground"
        >
          {title}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-3 text-sm leading-relaxed text-muted-foreground"
        >
          {description}
        </motion.p>
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </header>
  );
}

export function ModuleShell({ children }: { children: ReactNode }) {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1400px] px-5 pb-40 pt-20 sm:px-8"
    >
      {children}
    </motion.main>
  );
}

export function StatTile({
  label,
  value,
  sub,
  accent = "electric",
  delay = 0,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "electric" | "cyan" | "safe" | "risk" | "violet";
  delay?: number;
}) {
  const tone = {
    electric: "text-electric",
    cyan: "text-cyan",
    safe: "text-safe",
    risk: "text-risk",
    violet: "text-violet",
  }[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-2 font-display text-2xl font-bold tabular-nums sm:text-3xl", tone)}>
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
    </motion.div>
  );
}

const LEVEL_STYLE: Record<RiskLevel, string> = {
  safe: "border-safe/40 bg-safe/10 text-safe",
  elevated: "border-warn/40 bg-warn/10 text-warn",
  high: "border-risk/40 bg-risk/10 text-risk",
};

export function RiskBadge({ level, label }: { level: RiskLevel; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em]",
        LEVEL_STYLE[level],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label ?? (level === "safe" ? "Legitimate" : level === "elevated" ? "Elevated" : "High risk")}
    </span>
  );
}

export function Meter({ value, tone = "electric" }: { value: number; tone?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, value)}%` }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="h-full rounded-full"
        style={{ background: `var(--${tone})` }}
      />
    </div>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-xs text-muted-foreground", className)}>{children}</span>
  );
}

export const short = (s: string, n = 6) => `${s.slice(0, n + 2)}…${s.slice(-4)}`;
