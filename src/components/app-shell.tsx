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
      { to: "/monitor", label: "Live Stream", icon: Activity, badge: "Mempool" },
    ],
  },
  {
    label: "INVESTIGATE",
    items: [
      { to: "/detect", label: "Transaction Intelligence", icon: Radar },
      { to: "/batch", label: "Batch Scanner", icon: Layers },
      { to: "/cases", label: "Case Archive", icon: FolderSearch },
    ],
  },
  {
    label: "INTELLIGENCE",
    items: [
      { to: "/models", label: "AI Models (7)", icon: Brain },
      { to: "/analytics", label: "Threat Analytics", icon: BarChart2 },
      { to: "/reports", label: "Audit Reports", icon: Download },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { to: "/system", label: "Health & Telemetry", icon: Gauge },
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
      className="inline-flex h-7 w-7 items-center justify-center rounded border border-border bg-card text-muted-foreground transition hover:bg-secondary hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <nav className="flex h-full flex-col justify-between p-3.5">
      <div className="space-y-5">
        {/* Web3 Terminal Brand Header */}
        <Link to="/" onClick={onNavigate} className="flex items-center gap-2.5 px-1.5 py-1 group">
          <div className="grid h-7 w-7 place-items-center rounded border border-border bg-secondary text-foreground transition-colors group-hover:border-primary/50">
            <Box className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold tracking-tight text-foreground">
              <span>AEGIS</span>
              <span className="rounded bg-primary/10 px-1 py-0.2 text-[9px] font-semibold text-primary">v2.4</span>
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">Ethereum Intelligence</div>
          </div>
        </Link>

        {/* Navigation Sections */}
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-0.5">
            <div className="px-2 pb-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
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
                        "group flex items-center justify-between rounded px-2 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? "bg-secondary text-foreground font-semibold border-l-2 border-primary"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <item.icon
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 transition-colors",
                            active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                          )}
                        />
                        <span>{item.label}</span>
                      </div>
                      {item.badge ? (
                        <span className="rounded bg-safe/10 px-1 py-0.2 font-mono text-[9px] font-semibold text-safe">
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

      {/* Web3 Network Telemetry Footer */}
      <div className="rounded border border-border bg-card/80 p-2.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-foreground flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-safe animate-pulse" />
            Ethereum Mainnet
          </span>
          <span className="font-mono text-[10px] text-muted-foreground flex items-center gap-0.5">
            <Flame className="h-3 w-3 text-warn" /> 28 Gwei
          </span>
        </div>
        <div className="mt-1 font-mono text-[10px] text-muted-foreground">
          Block #19,485,021 · 7 Models Active
        </div>
      </div>
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
      {/* Web3 Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 overflow-y-auto border-r border-border bg-card/70 backdrop-blur-md lg:block">
        <SidebarNav />
      </aside>

      {/* Mobile Drawer */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-56 overflow-y-auto bg-card p-0">
          <SheetTitle className="sr-only">Web3 Navigation Menu</SheetTitle>
          <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Terminal Canvas */}
      <div className="lg:pl-56">
        <header className="sticky top-0 z-20 flex h-12 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-border text-muted-foreground transition hover:bg-secondary hover:text-foreground lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* On-Chain Search Bar */}
            <button
              onClick={() => setCmdOpen(true)}
              className="flex h-7 items-center gap-2 rounded border border-border bg-card px-2.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:bg-secondary sm:w-72"
            >
              <Search className="h-3 w-3" />
              <span className="flex-1 text-left font-mono text-[11px] truncate">
                Search tx (0x...), wallet, block, contract...
              </span>
              <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.2 font-mono text-[9px] sm:inline">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Live Network Pill */}
            <div className="hidden items-center gap-2 rounded border border-border bg-card px-2.5 py-0.5 text-xs sm:flex">
              <span className={cn("h-1.5 w-1.5 rounded-full", liveConnected ? "bg-safe" : "bg-warn")} />
              <span className="font-mono text-[11px] text-muted-foreground">
                Mainnet <span className="font-medium text-foreground">#19,485,021</span>
              </span>
            </div>

            <Link
              to="/detect"
              className="hidden items-center gap-1.5 rounded bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-xs transition hover:opacity-90 sm:inline-flex"
            >
              <Radar className="h-3 w-3" />
              <span>Investigate</span>
            </Link>

            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6">{children}</main>
      </div>

      {/* On-Chain Command Search Palette */}
      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Search transaction (0x...), wallet, block, contract, case..." />
        <CommandList>
          <CommandEmpty>No on-chain records found.</CommandEmpty>
          {recent.length > 0 ? (
            <CommandGroup heading="Recent On-Chain Investigations">
              {recent.map((r) => (
                <CommandItem key={r.id} value={`${r.id} ${r.hash}`} asChild>
                  <Link to="/cases" onClick={() => setCmdOpen(false)}>
                    <FolderSearch className="mr-2 h-3.5 w-3.5" />
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
                    <item.icon className="mr-2 h-3.5 w-3.5" />
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
