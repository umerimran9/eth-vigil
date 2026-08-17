import { Link, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity,
  BarChart3,
  Brain,
  Command as CommandIcon,
  Layers,
  Radar,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Home",
    items: [{ to: "/", label: "Core", icon: Sparkles }],
  },
  {
    label: "Investigate",
    items: [
      { to: "/detect", label: "Fraud Detection", icon: Radar },
      { to: "/batch", label: "Batch", icon: Layers },
      { to: "/monitor", label: "Live Monitor", icon: Activity },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { to: "/models", label: "AI Models", icon: Brain },
      { to: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "System",
    items: [{ to: "/settings", label: "Settings", icon: Settings }],
  },
];

export const NAV = NAV_GROUPS.flatMap((g) => g.items);

export function NavDock() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [hovered, setHovered] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname.startsWith(to);

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center pb-5 sm:pb-7">
        <motion.nav
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, type: "spring", stiffness: 180, damping: 22 }}
          onPointerLeave={() => setHovered(null)}
          className="pointer-events-auto flex max-w-[94vw] items-end gap-1 overflow-x-auto rounded-full glass-panel px-2.5 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label} className="flex items-end gap-1">
              {gi > 0 ? <span className="mx-0.5 h-8 w-px self-center bg-white/10" /> : null}
              {group.items.map((item) => {
                const active = isActive(item.to);
                const hot = hovered === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onPointerEnter={() => setHovered(item.to)}
                    className="group relative shrink-0"
                    aria-label={item.label}
                  >
                    <motion.div
                      animate={{ scale: hot ? 1.28 : 1, y: hot ? -8 : 0 }}
                      transition={{ type: "spring", stiffness: 420, damping: 24 }}
                      className={cn(
                        "relative grid h-11 w-11 place-items-center rounded-full transition-colors",
                        active
                          ? "bg-white/12 text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <item.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                      {active ? (
                        <motion.span
                          layoutId="dock-glow"
                          className="absolute inset-0 -z-10 rounded-full"
                          style={{
                            boxShadow:
                              "0 0 0 1px color-mix(in oklab, var(--cyan-accent) 45%, transparent), 0 10px 34px -8px color-mix(in oklab, var(--electric) 70%, transparent)",
                          }}
                        />
                      ) : null}
                    </motion.div>
                    <AnimatePresence>
                      {hot ? (
                        <motion.span
                          initial={{ opacity: 0, y: 6, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 6, scale: 0.9 }}
                          className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full glass-soft px-3 py-1 text-[11px] tracking-wide"
                        >
                          {item.label}
                        </motion.span>
                      ) : null}
                    </AnimatePresence>
                  </Link>
                );
              })}
            </div>
          ))}

          <span className="mx-1 h-8 w-px self-center bg-white/10" />
          <button
            onClick={() => setOpen(true)}
            aria-label="Open command palette"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:scale-110 hover:text-foreground"
          >
            <CommandIcon className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>
        </motion.nav>
      </div>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Jump to a workspace, model or action…" />
        <CommandList>
          <CommandEmpty>Nothing matched that query.</CommandEmpty>
          {NAV_GROUPS.map((group) => (
            <CommandGroup key={group.label} heading={group.label}>
              {group.items.map((item) => (
                <CommandItem key={item.to} value={item.label} asChild>
                  <Link to={item.to} onClick={() => setOpen(false)}>
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Link>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
