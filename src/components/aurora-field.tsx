import { useEffect, useRef } from "react";

/**
 * Clean ambient canvas matching Etherscan's solid dark navy aesthetic.
 */
export function AuroraField({ density = 28, showGrid = false }: { density?: number; showGrid?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pointer = { x: -9999, y: -9999 };

    const nodes = Array.from({ length: density }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.00025,
      vy: (Math.random() - 0.5) * 0.00025,
      r: Math.random() * 1.2 + 0.4,
      hot: Math.random() < 0.08,
    }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > 1) n.vx *= -1;
        if (n.y < 0 || n.y > 1) n.vy *= -1;
      }

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]!;
        const ax = a.x * w;
        const ay = a.y * h;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]!;
          const bx = b.x * w;
          const by = b.y * h;
          const d = Math.hypot(ax - bx, ay - by);
          if (d < 140) {
            const alpha = (1 - d / 140) * 0.15;
            ctx.strokeStyle = `rgba(56,189,248,${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
          }
        }

        const pd = Math.hypot(ax - pointer.x, ay - pointer.y);
        const boost = pd < 160 ? 1 - pd / 160 : 0;
        ctx.beginPath();
        ctx.arc(ax, ay, a.r + boost * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = a.hot
          ? `rgba(0,192,135,${0.5 + boost * 0.3})`
          : `rgba(56,189,248,${0.25 + boost * 0.35})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, [density]);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 bg-[#081028]">
      <canvas ref={ref} className="absolute inset-0 h-full w-full opacity-60" />
    </div>
  );
}
