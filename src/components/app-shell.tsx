import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BarChart2,
  Box,
  Brain,
  Download,
  FolderSearch,
  Gauge,
  Layers,
  LayoutDashboard,
  Menu,
  Moon,
  Radar,
  Search,
  Settings,
  Sun,
  Flame,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { apiFetch, WS_BASE_URL } from "@/lib/api";
import { classifyQuery, useNetworkState } from "@/lib/network-state";
import { EntityBadge, HexChip, type EntityKind } from "@/components/web3";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

interface RecentCase {
  id: string;
  hash: string;
  verdict: string;
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "NETWORK",
    items: [
      { to: "/", label: "Overview", icon: LayoutDashboard },
      { to: "/monitor", label: "Live Stream", icon: Activity, badge: "Live" },
    ],
  },
  {
    label: "DETECTION",
    items: [
      { to: "/detect", label: "Investigate", icon: Radar },
      { to: "/batch", label: "Batch Scanner", icon: Layers },
      { to: "/cases", label: "Case History", icon: FolderSearch },
    ],
  },
  {
    label: "INTELLIGENCE",
    items: [
      { to: "/models", label: "AI Models (7)", icon: Brain },
      { to: "/analytics", label: "Analytics", icon: BarChart2 },
      { to: "/reports", label: "Audit Reports", icon: Download },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { to: "/system", label: "System Health", icon: Gauge },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const NAV = NAV_GROUPS.flatMap((g) => g.items);

type Theme = "light" | "dark" | "system";
const THEME_KEY = "aegis:theme";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY) as Theme | null;
    if (saved === "light" || saved === "dark" || saved === "system") {
      setTheme(saved);
      applyTheme(saved);
    } else {
      applyTheme("dark");
    }
  }, []);

  const cycle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
  };

  const Icon = theme === "light" ? Sun : Moon;

  return (
    <button
      onClick={cycle}
      title={`Theme: ${theme} (click to toggle)`}
      aria-label={`Current theme is ${theme}. Click to switch.`}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-secondary hover:text-foreground"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <nav className="flex h-full flex-col justify-between p-4">
      <div className="space-y-6">
        {/* Brand Header */}
        <Link to="/" onClick={onNavigate} className="flex items-center gap-3 px-2 py-1 group">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/30 transition-transform group-hover:scale-105">
            <Box className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-bold tracking-tight text-foreground text-sm">
              <span>Aegis</span>
              <span className="rounded-full bg-primary/15 px-1.5 py-0.2 font-mono text-[9px] font-semibold text-primary">
                v2.4
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground">Ethereum Security</div>
          </div>
        </Link>

        {/* Navigation Sections */}
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-1">
            <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {group.label}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.to);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      className={cn(
                        "group flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all duration-150",
                        active
                          ? "bg-primary/15 text-primary font-semibold shadow-xs"
                          : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <item.icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-colors",
                            active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                          )}
                        />
                        <span>{item.label}</span>
                      </div>
                      {item.badge ? (
                        <span className="rounded-full bg-safe/10 px-2 py-0.5 font-mono text-[9px] font-semibold text-safe">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Live chain context: the network this whole product is bound to */}
      <SidebarNetwork />
    </nav>
  );
}

function SidebarNetwork() {
  const net = useNetworkState();
  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground">
          Ethereum Mainnet
        </span>
        <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-safe">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-safe" />
          live
        </span>
      </div>
      <dl className="divide-y divide-border font-mono text-[10px]">
        <div className="flex items-center justify-between px-3 py-1.5">
          <dt className="text-muted-foreground">head block</dt>
          <dd className="tabular-nums text-foreground">{net.blockLabel}</dd>
        </div>
        <div className="flex items-center justify-between px-3 py-1.5">
          <dt className="flex items-center gap-1 text-muted-foreground">
            <Flame className="h-2.5 w-2.5 text-warn" /> base fee
          </dt>
          <dd className="tabular-nums text-foreground">{net.baseFeeGwei.toFixed(1)} gwei</dd>
        </div>
        <div className="flex items-center justify-between px-3 py-1.5">
          <dt className="text-muted-foreground">detection</dt>
          <dd className="text-safe">7 models online</dd>
        </div>
      </dl>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [recent, setRecent] = useState<RecentCase[]>([]);
  const [liveConnected, setLiveConnected] = useState(false);
  const [query, setQuery] = useState("");
  const net = useNetworkState();
  const queryKind = classifyQuery(query);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(`${WS_BASE_URL}/api/v1/stream/live`);
      ws.onopen = () => setLiveConnected(true);
      ws.onclose = () => setLiveConnected(false);
      ws.onerror = () => setLiveConnected(false);
    } catch {
      setLiveConnected(false);
    }
    return () => {
      if (ws) ws.close();
    };
  }, []);

  useEffect(() => {
    if (!cmdOpen || recent.length > 0) return;
    apiFetch<any>("/api/v1/history").then(({ ok, data }) => {
      if (ok && Array.isArray(data?.history)) {
        setRecent(
          data.history
            .slice(0, 5)
            .map((h: any) => ({ id: h.id, hash: h.hash, verdict: h.verdict ?? "" })),
        );
      }
    });
  }, [cmdOpen, recent.length]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 overflow-y-auto border-r border-border bg-card/70 backdrop-blur-md lg:block">
        <SidebarNav />
      </aside>

      {/* Mobile Drawer */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-60 overflow-y-auto bg-card p-0">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Canvas */}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-secondary hover:text-foreground lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Global Search Bar */}
            <button
              onClick={() => setCmdOpen(true)}
              className="flex h-8 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs text-muted-foreground transition hover:border-primary/40 hover:bg-secondary sm:w-72"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="flex-1 text-left font-mono text-[11px] truncate">
                Search transaction, wallet, block, contract, entity…
              </span>
              <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.2 font-mono text-[9px] sm:inline">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Live chain read-out: block head + base fee, always present */}
            <div className="hidden items-stretch divide-x divide-border overflow-hidden rounded-md border border-border bg-card font-mono text-[10px] md:flex">
              <span className="flex items-center gap-1.5 px-2.5 py-1">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    liveConnected ? "animate-pulse bg-safe" : "bg-warn",
                  )}
                />
                <span className="uppercase tracking-wider text-muted-foreground">
                  {liveConnected ? "Mainnet · live" : "Mainnet · cached"}
                </span>
              </span>
              <span className="flex items-center px-2.5 py-1 tabular-nums text-foreground">
                {net.blockLabel}
              </span>
              <span className="hidden items-center px-2.5 py-1 tabular-nums text-muted-foreground lg:flex">
                {net.baseFeeGwei.toFixed(1)} gwei
              </span>
            </div>

            <Link
              to="/detect"
              className="hidden items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm shadow-primary/25 transition hover:opacity-90 sm:inline-flex"
            >
              <Radar className="h-3.5 w-3.5" />
              <span>Investigate</span>
            </Link>

            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6">{children}</main>
      </div>

      {/* Command Search Palette */}
      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search transaction, wallet, block, contract, entity…"
        />
        <CommandList>
          <CommandEmpty>No on-chain object or workspace matched.</CommandEmpty>
          {queryKind !== "unknown" ? (
            <CommandGroup heading="On-chain">
              <CommandItem value={`onchain-${query}`} asChild>
                <Link
                  to="/detect"
                  search={{ hash: query.trim(), aegisRun: queryKind === "transaction" }}
                  onClick={() => setCmdOpen(false)}
                  className="flex items-center gap-2"
                >
                  <EntityBadge kind={queryKind as EntityKind} />
                  <HexChip value={query.trim()} lead={12} tail={8} />
                  <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {queryKind === "block" ? "inspect block" : "run detection"}
                  </span>
                </Link>
              </CommandItem>
            </CommandGroup>
          ) : null}
          {recent.length > 0 ? (
            <CommandGroup heading="Recent Investigations">
              {recent.map((r) => (
                <CommandItem key={r.id} value={`${r.id} ${r.hash}`} asChild>
                  <Link to="/cases" onClick={() => setCmdOpen(false)}>
                    <FolderSearch className="mr-2 h-4 w-4" />
                    <span className="font-mono text-xs">{r.hash.slice(0, 14)}…{r.hash.slice(-6)}</span>
                    {r.verdict ? (
                      <span className="ml-auto font-mono text-[11px] font-medium text-primary">{r.verdict}</span>
                    ) : null}
                  </Link>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {NAV_GROUPS.map((group) => (
            <CommandGroup key={group.label} heading={group.label}>
              {group.items.map((item) => (
                <CommandItem key={item.to} value={item.label} asChild>
                  <Link to={item.to} onClick={() => setCmdOpen(false)}>
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Link>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </div>
  );
}
