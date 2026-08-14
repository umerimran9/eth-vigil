import { useEffect, useRef, useState } from "react";
import { Box, Activity, Shield } from "lucide-react";

interface Node3D {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  hash: string;
  blockNum: number;
  status: "verified" | "evaluating" | "mined";
}

export function BlockchainHero3D() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeBlock, setActiveBlock] = useState<string>("0x8a3f9e...2b1c");
  const [fps, setFps] = useState<number>(60);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 800);
    let height = (canvas.height = 320);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = 320;
    };
    window.addEventListener("resize", handleResize);

    const numNodes = 12;
    const nodes: Node3D[] = [];
    const baseBlock = 19485010;

    for (let i = 0; i < numNodes; i++) {
      const radius = 170;
      const theta = (i / numNodes) * Math.PI * 2;
      const phi = (Math.random() - 0.5) * 0.7;
      nodes.push({
        x: Math.cos(theta) * radius + (Math.random() - 0.5) * 30,
        y: Math.sin(phi) * 100 + (Math.random() - 0.5) * 20,
        z: Math.sin(theta) * radius + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        vz: (Math.random() - 0.5) * 0.15,
        size: i % 3 === 0 ? 13 : 9,
        hash: `0x${Math.random().toString(16).slice(2, 8)}...${Math.random().toString(16).slice(2, 6)}`,
        blockNum: baseBlock + i,
        status: i === 0 ? "evaluating" : i % 2 === 0 ? "verified" : "mined",
      });
    }

    let mouseX = 0;
    let mouseY = 0;
    let targetRotX = 0;
    let targetRotY = 0;
    let rotX = 0.25;
    let rotY = 0;

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left - width / 2;
      const y = e.clientY - rect.top - height / 2;
      mouseX = x * 0.0008;
      mouseY = y * 0.0008;
    };
    canvas.addEventListener("mousemove", onMouseMove);

    const fov = 420;
    let lastTime = performance.now();
    let frameCount = 0;

    const render = (time: number) => {
      frameCount++;
      if (time - lastTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = time;
      }

      ctx.clearRect(0, 0, width, height);

      // Smooth subtle rotation
      targetRotY += 0.002;
      rotY += (targetRotY + mouseX - rotY) * 0.04;
      rotX += (mouseY * 0.4 + 0.25 - rotX) * 0.04;

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      // Project 3D nodes
      const projected = nodes.map((node) => {
        let x1 = node.x * cosY - node.z * sinY;
        let z1 = node.z * cosY + node.x * sinY;
        let y1 = node.y * cosX - z1 * sinX;
        let z2 = z1 * cosX + node.y * sinX;

        const scale = fov / (fov + z2 + 250);
        const px = x1 * scale + width / 2;
        const py = y1 * scale + height / 2;

        return {
          ...node,
          px,
          py,
          scale,
          z2,
        };
      });

      projected.sort((a, b) => b.z2 - a.z2);

      // Clean subtle strands
      ctx.lineWidth = 1;
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const a = projected[i];
          const b = projected[j];
          if (!a || !b) continue;
          const dist = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

          if (dist < 150) {
            const alpha = Math.max(0, (1 - dist / 150) * 0.25 * Math.min(a.scale, b.scale));
            ctx.strokeStyle = `rgba(148, 163, 184, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.px, a.py);
            ctx.lineTo(b.px, b.py);
            ctx.stroke();

            // Subtle travelling pulse
            const pulseT = (time * 0.0008 + (i + j) * 0.25) % 1;
            const pulseX = a.px + (b.px - a.px) * pulseT;
            const pulseY = a.py + (b.py - a.py) * pulseT;
            ctx.fillStyle = `rgba(59, 130, 246, ${alpha * 1.8})`;
            ctx.beginPath();
            ctx.arc(pulseX, pulseY, 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Draw refined isometric 3D blocks
      for (const p of projected) {
        const s = p.size * p.scale;
        ctx.save();
        ctx.translate(p.px, p.py);

        const h = s * 0.75;
        const w = s * 1.15;

        // Top face
        ctx.beginPath();
        ctx.moveTo(0, -h);
        ctx.lineTo(w / 2, -h / 2);
        ctx.lineTo(0, 0);
        ctx.lineTo(-w / 2, -h / 2);
        ctx.closePath();
        ctx.fillStyle = p.status === "evaluating" ? "#2563eb" : p.status === "verified" ? "#059669" : "#334155";
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.stroke();

        // Left face
        ctx.beginPath();
        ctx.moveTo(-w / 2, -h / 2);
        ctx.lineTo(0, 0);
        ctx.lineTo(0, h);
        ctx.lineTo(-w / 2, h / 2);
        ctx.closePath();
        ctx.fillStyle = p.status === "evaluating" ? "#1d4ed8" : p.status === "verified" ? "#047857" : "#1e293b";
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.stroke();

        // Right face
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(w / 2, -h / 2);
        ctx.lineTo(w / 2, h / 2);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fillStyle = p.status === "evaluating" ? "#1e40af" : p.status === "verified" ? "#065f46" : "#0f172a";
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx.stroke();

        if (p.scale > 0.88) {
          ctx.fillStyle = "rgba(148, 163, 184, 0.85)";
          ctx.font = "10px 'JetBrains Mono', monospace";
          ctx.textAlign = "center";
          ctx.fillText(`#${p.blockNum}`, 0, h + 14);
        }

        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <div className="relative h-64 w-full sm:h-72">
        <canvas ref={canvasRef} className="h-full w-full cursor-crosshair" />

        {/* Minimalist Floating Overlay Cards */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-5">
          <div className="flex items-center justify-between">
            <div className="pointer-events-auto inline-flex items-center gap-2 rounded-lg border border-border bg-card/90 px-3 py-1.5 backdrop-blur-md shadow-xs">
              <span className="h-2 w-2 rounded-full bg-safe" />
              <span className="font-mono text-xs font-semibold text-foreground">
                Ethereum 3D Consensus Topology
              </span>
            </div>

            <div className="pointer-events-auto hidden items-center gap-3 rounded-lg border border-border bg-card/90 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-md shadow-xs sm:flex">
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{fps} FPS</span>
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="pointer-events-auto rounded-xl border border-border bg-card/90 p-3 backdrop-blur-md shadow-xs">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Target Block
              </span>
              <div className="mt-0.5 flex items-center gap-2 font-mono text-xs font-bold text-foreground">
                <span>#19,485,021</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-primary">{activeBlock}</span>
              </div>
            </div>

            <div className="pointer-events-auto hidden rounded-xl border border-border bg-card/90 p-3 backdrop-blur-md shadow-xs sm:block">
              <div className="text-xs font-medium text-foreground">
                7 Machine Learning Models Serving
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                1.8ms Average Latency · Zero Drift
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
