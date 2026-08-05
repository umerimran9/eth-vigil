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
      initial={{ opacity: 0, y: 22, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      {...(tilt
        ? {
            whileHover: { y: -5, rotateX: 1.4, rotateY: -1.4 },
            style: { transformPerspective: 1200 },
          }
        : {})}
      className={cn("rounded-3xl glass-panel p-6", className)}
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
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-mono text-[11px] uppercase tracking-[0.34em] text-cyan/80"
        >
          {eyebrow}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mt-3 text-4xl font-semibold sm:text-5xl"
        >
          {title}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="mt-4 text-[15px] leading-relaxed text-muted-foreground"
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
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-[1400px] px-5 pb-40 pt-24 sm:px-8"
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
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4 }}
      className="relative overflow-hidden rounded-3xl glass-soft p-5"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-3 font-display text-3xl font-semibold tabular-nums", tone)}>
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
      <div className="pointer-events-none absolute inset-x-0 -bottom-16 h-24 opacity-40 blur-2xl"
        style={{ background: "var(--gradient-core)" }} />
    </motion.div>
  );
}

const LEVEL_STYLE: Record<RiskLevel, string> = {
  safe: "border-safe/35 bg-safe/12 text-safe",
  elevated: "border-warn/35 bg-warn/12 text-warn",
  high: "border-risk/40 bg-risk/14 text-risk",
};

export function RiskBadge({ level, label }: { level: RiskLevel; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em]",
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
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
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
