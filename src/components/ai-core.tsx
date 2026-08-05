import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const ORBITS = [
  { size: 220, dur: 26, count: 3 },
  { size: 330, dur: 40, count: 5 },
  { size: 460, dur: 58, count: 7 },
];

/** Central AI Core — the visual identity of the platform. */
export function AiCore({ className, scale = 1 }: { className?: string; scale?: number }) {
  return (
    <div
      className={cn("relative grid place-items-center", className)}
      style={{ width: 520 * scale, height: 520 * scale }}
    >
      {ORBITS.map((orbit, oi) => (
        <motion.div
          key={orbit.size}
          className="absolute rounded-full border border-white/8"
          style={{ width: orbit.size * scale, height: orbit.size * scale }}
          animate={{ rotate: oi % 2 === 0 ? 360 : -360 }}
          transition={{ duration: orbit.dur, repeat: Infinity, ease: "linear" }}
        >
          {Array.from({ length: orbit.count }).map((_, i) => {
            const angle = (i / orbit.count) * Math.PI * 2;
            const r = (orbit.size * scale) / 2;
            return (
              <span
                key={i}
                className="absolute h-2 w-2 rounded-full bg-cyan shadow-[0_0_14px_2px_var(--cyan-accent)]"
                style={{
                  left: `calc(50% + ${Math.cos(angle) * r}px - 4px)`,
                  top: `calc(50% + ${Math.sin(angle) * r}px - 4px)`,
                  opacity: 0.5 + (i % 3) * 0.2,
                }}
              />
            );
          })}
        </motion.div>
      ))}

      <div
        className="absolute rounded-full blur-2xl animate-core-pulse"
        style={{
          width: 260 * scale,
          height: 260 * scale,
          background: "var(--gradient-core)",
          opacity: 0.55,
        }}
      />

      <motion.div
        className="relative grid place-items-center rounded-full"
        style={{ width: 148 * scale, height: 148 * scale }}
        animate={{ scale: [1, 1.035, 1] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="absolute inset-0 rounded-full glass-panel" />
        <div
          className="absolute inset-[14%] rounded-full"
          style={{ background: "var(--gradient-core)", opacity: 0.85 }}
        />
        <div className="absolute inset-[30%] rounded-full bg-background/70 backdrop-blur-md" />
        <div className="relative text-center">
          <div className="font-mono text-[10px] tracking-[0.32em] text-cyan/80">CORE</div>
          <div className="font-display text-xl font-semibold">AEGIS</div>
        </div>
        <motion.div
          className="absolute inset-0 rounded-full border-t-2 border-cyan/70"
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        />
      </motion.div>
    </div>
  );
}
