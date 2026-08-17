import React from "react";
import { Printer, X, ShieldAlert, ShieldCheck, AlertTriangle, FileText, CheckCircle2 } from "lucide-react";
import { RiskBadge, short } from "./ui-kit";
import { MODELS, type RiskLevel } from "@/lib/platform-data";
import { cn } from "@/lib/utils";

export interface ForensicReportData {
  hash: string;
  from: string;
  to: string;
  value: number | string;
  gas: number | string;
  block?: number | string | null;
  risk: number;
  level: RiskLevel;
  verdict?: string;
  timestamp?: string | null;
  modelScores?: Record<string, number> | Array<{ name?: string; model_id?: string; probability: number; verdict: string }>;
  featuresDefaulted?: boolean;
}

export function ForensicPdfModal({
  data,
  onClose,
}: {
  data: ForensicReportData | null;
  onClose: () => void;
}) {
  if (!data) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = data.timestamp
    ? new Date(data.timestamp).toUTCString()
    : new Date().toUTCString();

  // Normalize model scores
  const normalizedScores: Array<{ name: string; pct: number; isHigh: boolean }> = [];
  if (data.modelScores) {
    if (Array.isArray(data.modelScores)) {
      data.modelScores.forEach((m) => {
        const pct = Number((m.probability * 100).toFixed(1));
        normalizedScores.push({
          name: m.name || m.model_id || "Model",
          pct,
          isHigh: pct >= 50,
        });
      });
    } else {
      Object.entries(data.modelScores).forEach(([mId, score]) => {
        const meta = MODELS.find((m) => m.id.replace(/-/g, "_") === mId || m.id === mId);
        const pct = Number((score * (score <= 1 ? 100 : 1)).toFixed(1));
        normalizedScores.push({
          name: meta?.name || mId,
          pct,
          isHigh: pct >= 50,
        });
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm print:static print:inset-auto print:p-0 print:bg-transparent print:backdrop-blur-none">
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-[#081028] p-6 shadow-2xl print:max-h-none print:w-full print:max-w-none print:border-none print:bg-transparent print:p-0 print:shadow-none">
        {/* Header Actions (hidden in print) */}
        <div className="no-print mb-4 flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-cyan" />
            <h2 className="text-base font-semibold text-foreground">Forensic Audit Dossier</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90"
            >
              <Printer className="h-4 w-4" /> Print / Save as PDF
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-border bg-card p-2 text-muted-foreground transition hover:text-foreground"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Forensic Report Document */}
        <div className="space-y-6 rounded-lg border border-border bg-[#111c38] p-6 text-foreground print:border-none print:p-0">
          {/* Document Header */}
          <div className="flex items-start justify-between border-b border-border pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold tracking-wider text-cyan">
                  AEGIS FORENSIC AUDIT REPORT
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Cryptographic Anomaly Verification & Multi-Model Consensus Telemetry
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                Generated: {formattedDate}
              </p>
            </div>
            <div className="text-right">
              <RiskBadge level={data.level} label={data.level === "safe" ? "Clear" : data.level === "elevated" ? "Medium" : "High Risk"} />
              <div className="mt-1 font-mono text-xl font-bold text-foreground">
                {data.risk.toFixed(1)} / 100
              </div>
            </div>
          </div>

          {/* On-Chain Transaction Parameters */}
          <div>
            <h3 className="font-mono text-[11px] uppercase tracking-wider text-cyan mb-2">
              1. On-Chain Transaction Parameters
            </h3>
            <div className="grid gap-2.5 sm:grid-cols-2 rounded-lg border border-border bg-[#0e1832] p-4 text-xs font-mono">
              <div className="break-all">
                <span className="text-muted-foreground block text-[10px] uppercase tracking-wider">Transaction Hash</span>
                <span className="text-foreground">{data.hash}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase tracking-wider">Block Number</span>
                <span className="text-foreground">
                  {data.block ? `#${data.block.toLocaleString()}` : "Pending / Mainnet Ingestion"}
                </span>
              </div>
              <div className="break-all">
                <span className="text-muted-foreground block text-[10px] uppercase tracking-wider">From (Sender)</span>
                <span className="text-foreground">{data.from}</span>
              </div>
              <div className="break-all">
                <span className="text-muted-foreground block text-[10px] uppercase tracking-wider">To (Contract / Recipient)</span>
                <span className="text-foreground">{data.to}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase tracking-wider">Transfer Value</span>
                <span className="text-foreground font-semibold">{data.value} ETH</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase tracking-wider">Gas Consumption</span>
                <span className="text-foreground font-semibold">{Number(data.gas).toLocaleString()} gas</span>
              </div>
            </div>
          </div>

          {/* Token Default Notice (if applicable) */}
          {data.featuresDefaulted && (
            <div className="flex items-center gap-2 rounded-lg border border-warn/40 bg-warn/10 p-3 text-xs text-warn">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                Scored primarily on gas/value mechanics: sender address has no recorded ERC-20 token history on Etherscan. Token features imputed safely at baseline neutral zero.
              </span>
            </div>
          )}

          {/* Multi-Model Ensemble Voting Scorecard */}
          {normalizedScores.length > 0 && (
            <div>
              <h3 className="font-mono text-[11px] uppercase tracking-wider text-cyan mb-2">
                2. Multi-Model Ensemble Consensus Scorecard
              </h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 rounded-lg border border-border bg-[#0e1832] p-4 text-xs font-mono">
                {normalizedScores.map((m) => (
                  <div
                    key={m.name}
                    className={cn(
                      "flex items-center justify-between rounded border p-2",
                      m.isHigh
                        ? "border-risk/40 bg-risk/10 text-risk"
                        : "border-safe/40 bg-safe/10 text-safe",
                    )}
                  >
                    <span className="font-semibold text-foreground">{m.name}</span>
                    <span className="font-bold">{m.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Executive Security Clearance Summary */}
          <div className="rounded-lg border border-border bg-[#0e1832] p-4 text-xs space-y-2">
            <h3 className="font-mono text-[11px] uppercase tracking-wider text-cyan">
              3. Forensic Verdict Summary
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              This transaction evaluated to an overall risk score of{" "}
              <strong className="text-foreground">{data.risk.toFixed(1)}%</strong> resulting in a classification of{" "}
              <strong className="text-foreground">
                {data.level === "safe" ? "CLEAR" : data.level === "elevated" ? "MEDIUM" : "HIGH RISK"}
              </strong>
              . Analysis synthesized across gradient boosting trees (LightGBM, XGBoost, Random Forest), deep neural networks (PyTorch MLP, FT-Transformer), and linear guardrails calibrated to 61 on-chain features.
            </p>
          </div>

          {/* Document Footer */}
          <div className="border-t border-border pt-4 text-center font-mono text-[10px] text-muted-foreground">
            Aegis AI Fraud Detection System · BCCC-DeFiFraudTrans-2025 Verification Protocol
          </div>
        </div>
      </div>
    </div>
  );
}
