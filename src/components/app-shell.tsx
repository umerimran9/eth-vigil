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
    label: "Network",
    items: [
      { to: "/", label: "Network Overview", icon: LayoutDashboard },
      { to: "/monitor", label: "Live Stream", icon: Activity, badge: "Live" },
    ],
  },
  {
    label: "Investigate",
    items: [
      { to: "/detect", label: "Transaction", icon: Radar },
      { to: "/batch", label: "Batch Scanner", icon: Layers },
      { to: "/cases", label: "Cases", icon: FolderSearch },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { to: "/models", label: "AI Models", icon: Brain },
      { to: "/analytics", label: "Analytics", icon: BarChart2 },
      { to: "/reports", label: "Audit Reports", icon: Download },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/system", label: "Health", icon: Gauge },
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

function SidebarNetwork() {
  const net = useNetworkState();
  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground">
          {net.chain}
        </span>
        <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-safe">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-safe" />
          live
        </span>
      </div>
      <dl className="divide-y divide-border font-mono text-[10px]">
        <div className="flex items-center justify-between px-3 py-1.5">
          <dt className="text-muted-foreground">block</dt>
          <dd className="tabular-nums text-foreground">{net.blockLabel}</dd>
        </div>
        <div className="flex items-center justify-between px-3 py-1.5">
          <dt className="text-muted-foreground">base fee</dt>
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

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <nav className="flex h-full flex-col justify-between p-4">
      <div className="space-y-6">
        {/* Brand Header */}
        <Link to="/" onClick={onNavigate} className="flex items-center gap-3 px-2 py-1 group">
          <div className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card text-foreground transition-transform duration-200 group-hover:scale-105 shadow-sm">
            <Box className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-foreground">Aegis</div>
            <div className="text-[11px] text-muted-foreground">Ethereum Security</div>
          </div>
        </Link>

        {/* Navigation Sections */}
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-1">
            <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
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
                        "group flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-150",
                        active
                          ? "bg-secondary text-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
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
                        <span className="rounded-full bg-safe/10 px-1.5 py-0.2 text-[9px] font-semibold text-safe border border-safe/20">
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

      {/* Live network context -- the chain the whole product is bound to */}
      <SidebarNetwork />
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [recent, setRecent] = useState<RecentCase[]>([]);
  const [liveConnected, setLiveConnected] = useState(false);

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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 overflow-y-auto border-r border-border bg-card/60 backdrop-blur-md lg:block">
        <SidebarNav />
      </aside>

      {/* Mobile Drawer */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-60 overflow-y-auto bg-card p-0">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Content Canvas */}
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

            <button
              onClick={() => setCmdOpen(true)}
              className="flex h-8 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs text-muted-foreground transition hover:border-primary/40 hover:bg-secondary sm:w-60"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="flex-1 text-left">Search transactions…</span>
              <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[9px] sm:inline">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden items-center gap-2 rounded-lg border border-border bg-card px-3 py-1 text-xs sm:flex">
              <span className={cn("h-2 w-2 rounded-full", liveConnected ? "bg-safe" : "bg-warn")} />
              <span className="font-mono text-[11px] text-muted-foreground">
                Mainnet <span className="font-medium text-foreground">#19,485,021</span>
              </span>
            </div>

            <Link
              to="/detect"
              className="hidden items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs transition hover:opacity-90 sm:inline-flex"
            >
              <Radar className="h-3.5 w-3.5" />
              <span>Investigate</span>
            </Link>

            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1360px] px-4 py-6 sm:px-6">{children}</main>
      </div>

      {/* Command Search Palette */}
      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Search transactions, wallets, or features…" />
        <CommandList>
          <CommandEmpty>No matching results.</CommandEmpty>
          {recent.length > 0 ? (
            <CommandGroup heading="Recent Investigations">
              {recent.map((r) => (
                <CommandItem key={r.id} value={`${r.id} ${r.hash}`} asChild>
                  <Link to="/cases" onClick={() => setCmdOpen(false)}>
                    <FolderSearch className="mr-2 h-4 w-4" />
                    <span className="font-mono text-xs">{r.hash.slice(0, 12)}…{r.hash.slice(-6)}</span>
                    {r.verdict ? (
                      <span className="ml-auto text-xs font-medium text-primary">{r.verdict}</span>
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
