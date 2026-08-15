import { useEffect, useRef, useState } from "react";
import { Box, Activity, ShieldAlert, Cpu, Flame, Layers } from "lucide-react";

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
  txCount: number;
  gasUsedM: number;
  status: "verified" | "evaluating" | "anomaly";
  type: "block" | "contract" | "wallet";
}

export function BlockchainHero3D() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node3D | null>(null);
  const [fps, setFps] = useState<number>(60);
  const [hoveredNode, setHoveredNode] = useState<Node3D | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 800);
    let height = (canvas.height = 300);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = 300;
    };
    window.addEventListener("resize", handleResize);

    const numNodes = 14;
    const nodes: Node3D[] = [];
    const baseBlock = 19485010;

    for (let i = 0; i < numNodes; i++) {
      const radius = 175;
      const theta = (i / numNodes) * Math.PI * 2;
      const phi = (Math.random() - 0.5) * 0.75;
      const isAnomaly = i === 3 || i === 8;
      const isEvaluating = i === 0;

      nodes.push({
        x: Math.cos(theta) * radius + (Math.random() - 0.5) * 25,
        y: Math.sin(phi) * 95 + (Math.random() - 0.5) * 20,
        z: Math.sin(theta) * radius + (Math.random() - 0.5) * 25,
        vx: (Math.random() - 0.5) * 0.1,
        vy: (Math.random() - 0.5) * 0.1,
        vz: (Math.random() - 0.5) * 0.1,
        size: i % 3 === 0 ? 13 : 9,
        hash: `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`,
        blockNum: baseBlock + i,
        txCount: Math.floor(140 + Math.random() * 180),
        gasUsedM: Number((12.4 + Math.random() * 16.5).toFixed(1)),
        status: isEvaluating ? "evaluating" : isAnomaly ? "anomaly" : "verified",
        type: i % 4 === 0 ? "contract" : i % 3 === 0 ? "wallet" : "block",
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

      // Smooth rotation with mouse influence
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

      // Draw cryptographic connecting strands
      ctx.lineWidth = 1;
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const a = projected[i];
          const b = projected[j];
          if (!a || !b) continue;
          const dist = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

          if (dist < 155) {
            const alpha = Math.max(0, (1 - dist / 155) * 0.25 * Math.min(a.scale, b.scale));
            ctx.strokeStyle = a.status === "anomaly" || b.status === "anomaly"
              ? `rgba(244, 63, 94, ${alpha * 1.5})`
              : `rgba(139, 148, 158, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.px, a.py);
            ctx.lineTo(b.px, b.py);
            ctx.stroke();

            // Cryptographic traveling pulse packet
            const pulseT = (time * 0.0008 + (i + j) * 0.2) % 1;
            const pulseX = a.px + (b.px - a.px) * pulseT;
            const pulseY = a.py + (b.py - a.py) * pulseT;
            ctx.fillStyle = a.status === "anomaly" || b.status === "anomaly"
              ? `rgba(244, 63, 94, ${alpha * 2})`
              : `rgba(59, 130, 246, ${alpha * 2})`;
            ctx.beginPath();
            ctx.arc(pulseX, pulseY, 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Draw 3D Isometric Block Nodes
      for (const p of projected) {
        const s = p.size * p.scale;
        ctx.save();
        ctx.translate(p.px, p.py);

        const h = s * 0.72;
        const w = s * 1.15;

        // Top face
        ctx.beginPath();
        ctx.moveTo(0, -h);
        ctx.lineTo(w / 2, -h / 2);
        ctx.lineTo(0, 0);
        ctx.lineTo(-w / 2, -h / 2);
        ctx.closePath();
        ctx.fillStyle =
          p.status === "anomaly"
            ? "#f43f5e"
            : p.status === "evaluating"
            ? "#2563eb"
            : "#10b981";
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
        ctx.stroke();

        // Left face
        ctx.beginPath();
        ctx.moveTo(-w / 2, -h / 2);
        ctx.lineTo(0, 0);
        ctx.lineTo(0, h);
        ctx.lineTo(-w / 2, h / 2);
        ctx.closePath();
        ctx.fillStyle =
          p.status === "anomaly"
            ? "#be123c"
            : p.status === "evaluating"
            ? "#1d4ed8"
            : "#047857";
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.stroke();

        // Right face
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(w / 2, -h / 2);
        ctx.lineTo(w / 2, h / 2);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fillStyle =
          p.status === "anomaly"
            ? "#881337"
            : p.status === "evaluating"
            ? "#1e40af"
            : "#065f46";
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.stroke();

        // Monospace block label
        if (p.scale > 0.85) {
          ctx.fillStyle = "rgba(139, 148, 158, 0.9)";
          ctx.font = "9px 'JetBrains Mono', monospace";
          ctx.textAlign = "center";
          ctx.fillText(`#${p.blockNum}`, 0, h + 13);
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
    <div className="relative overflow-hidden rounded border border-border bg-card">
      <div className="relative h-60 w-full sm:h-68">
        <canvas ref={canvasRef} className="h-full w-full cursor-crosshair" />

        {/* Web3 Terminal Overlay Badges */}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
          <div className="flex items-center justify-between">
            <div className="pointer-events-auto inline-flex items-center gap-2 rounded border border-border bg-card/90 px-2.5 py-1 backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-safe" />
              <span className="font-mono text-[11px] font-semibold text-foreground">
                Ethereum Consensus & Topology Graph
              </span>
            </div>

            <div className="pointer-events-auto hidden items-center gap-2.5 rounded border border-border bg-card/90 px-2.5 py-1 font-mono text-[10px] text-muted-foreground backdrop-blur-md sm:flex">
              <span>{fps} FPS</span>
              <span>·</span>
              <span>Target: #19,485,021</span>
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-2.5">
            <div className="pointer-events-auto rounded border border-border bg-card/90 p-2.5 backdrop-blur-md">
              <div className="font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                On-Chain Graph Nodes
              </div>
              <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-foreground">
                <span>14 Active Epochs</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-safe">12 Clear</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-risk">2 Flagged</span>
              </div>
            </div>

            <div className="pointer-events-auto hidden rounded border border-border bg-card/90 p-2.5 backdrop-blur-md sm:block">
              <div className="font-mono text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                Detection Engine
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-foreground">
                7 Models Online · 1.8ms P50 Latency
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
