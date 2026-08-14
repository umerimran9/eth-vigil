import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/lib/platform-data";

// Flat dashboard primitives. No glass, no blur, no gradients, one card
// pattern. The additions below exist because the same three components
// (Panel + PageHeader + StatTile) were being bent to cover every job on every
// page, which is what made twelve different screens read as one template.

export function Panel({
  children,
  className,
  delay: _delay,
  tilt: _tilt,
}: {
  children: ReactNode;
  className?: string | undefined;
  /** kept for call-site compatibility; entrance animations were removed */
  delay?: number | undefined;
  tilt?: boolean | undefined;
}) {
  return <div className={cn("card-flat rounded-lg p-5", className)}>{children}</div>;
}

/**
 * Page title block.
 *
 * `description` is optional now. Every page used to carry a paragraph under
 * its H1 explaining what the page was and, more often, reassuring the reader
 * that the numbers were real ("nothing hardcoded, nothing simulated"). A
 * product that works does not narrate its own trustworthiness in the header;
 * it just shows correct data and puts caveats next to the specific number
 * they apply to. Kept for the few pages where a line of orientation genuinely
 * helps, dropped everywhere else.
 *
 * `eyebrow` is optional for the same reason -- a kicker above every title is
 * a template artifact when the title is already unambiguous.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow?: string | undefined;
  title: string;
  description?: string | undefined;
  aside?: ReactNode | undefined;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h1 className={cn("text-xl font-semibold tracking-tight sm:text-2xl", eyebrow && "mt-1.5")}>
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </header>
  );
}

export function ModuleShell({ children }: { children: ReactNode }) {
  return <div className="pb-16">{children}</div>;
}

/**
 * Section label inside a page. Sits above a table or a group of rows without
 * the weight of a second H1, and takes a trailing slot for the one action
 * that belongs to that section.
 */
export function SectionHeading({
  title,
  hint,
  action,
  className,
}: {
  title: string;
  // `| undefined` throughout: tsconfig has exactOptionalPropertyTypes, so a
  // caller passing a conditionally-undefined value is a type error without it.
  hint?: string | undefined;
  action?: ReactNode | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={cn("flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1", className)}>
      <h2 className="text-sm font-semibold">{title}</h2>
      {action ? <div className="ml-auto">{action}</div> : null}
      {hint ? <p className="w-full text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * One labelled value. The workhorse for transaction detail, where a
 * definition list beats a card grid: it stays scannable at twenty rows, and
 * it does not imply that every field is equally important the way a wall of
 * StatTiles does.
 */
export function KeyValue({
  label,
  children,
  mono = false,
  className,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 truncate text-sm", mono && "font-mono text-xs")}>{children}</dd>
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
  accent = "electric",
  delay: _delay,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "electric" | "cyan" | "safe" | "risk" | "violet";
  delay?: number;
}) {
  const tone = {
    electric: "text-foreground",
    cyan: "text-foreground",
    violet: "text-foreground",
    safe: "text-safe",
    risk: "text-risk",
  }[accent];
  return (
    <div className="card-flat rounded-lg p-4">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={cn("mt-2 text-2xl font-semibold tabular-nums", tone)}>{value}</div>
      {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

const LEVEL_STYLE: Record<RiskLevel, string> = {
  safe: "border-safe/30 bg-safe/10 text-safe",
  elevated: "border-warn/30 bg-warn/10 text-warn",
  high: "border-risk/30 bg-risk/10 text-risk",
};

export function RiskBadge({ level, label }: { level: RiskLevel; label?: string | undefined }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        LEVEL_STYLE[level],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label ?? (level === "safe" ? "Legitimate" : level === "elevated" ? "Elevated" : "High risk")}
    </span>
  );
}

export function Meter({ value, tone = "brand" }: { value: number; tone?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: `var(--${tone})` }}
      />
    </div>
  );
}

/**
 * Designed empty state. Previously each page hand-rolled a centred paragraph,
 * and several offered no way out of the empty condition -- a dead end is a
 * worse failure than an ugly one.
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string | undefined;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <p className="text-sm font-medium">{title}</p>
      {body ? (
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{body}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/** Loading placeholder that matches the shape of what is arriving. */
export function SkeletonRows({
  rows = 4,
  className,
}: {
  rows?: number | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-9 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}

export const short = (s: string, n = 6) => `${s.slice(0, n + 2)}…${s.slice(-4)}`;

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-xs text-muted-foreground", className)}>{children}</span>
  );
}
