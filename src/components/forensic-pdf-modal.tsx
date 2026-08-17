import React from "react";
import {
  Printer,
  X,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  FileText,
  CheckCircle2,
  Activity,
  Layers,
  Sparkles,
  SearchCode,
  Lock,
} from "lucide-react";
import { RiskBadge, short } from "./ui-kit";
import { actionLabel, MODELS, type RiskLevel } from "@/lib/platform-data";
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
  action?: string;
  confidence?: number;
  latencyMs?: number;
  timestamp?: string | null;
  modelScores?: Record<string, number> | Array<{ name?: string; model_id?: string; probability: number; verdict: string }>;
  featuresDefaulted?: boolean;
  shapWaterfall?: Array<{ feature: string; shap_value?: number; contribution?: number; value?: any }>;
  recommendations?: string[];
  transaction?: any;
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

  const shapItems = (data.shapWaterfall || []).slice(0, 8);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm print:static print:inset-auto print:p-0 print:bg-transparent print:backdrop-blur-none">
      <div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-border bg-[#081028] p-6 shadow-2xl print:max-h-none print:w-full print:max-w-none print:border-none print:bg-transparent print:p-0 print:shadow-none">
        {/* Header Actions (hidden in print) */}
        <div className="no-print mb-4 flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-cyan" />
            <div>
              <h2 className="text-base font-semibold text-foreground">Forensic Transaction Audit Dossier</h2>
              <p className="text-xs text-muted-foreground">Complete multi-model & SHAP explainability telemetry</p>
            </div>
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
        <div className="space-y-6 rounded-lg border border-border bg-[#111c38] p-6 text-foreground print:border-none print:p-0 print:space-y-4">
          {/* Document Header */}
          <div className="flex items-start justify-between border-b border-border pb-5 print:pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold tracking-wider text-cyan print:text-xs">
                  AEGIS FORENSIC TRANSACTION AUDIT REPORT
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground print:text-[10px]">
                Cryptographic Anomaly Verification, Multi-Model Consensus & Exact SHAP Attributions
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-muted-foreground print:text-[8px]">
                Generated: {formattedDate} · Protocol: BCCC-DeFiFraudTrans-2025
              </p>
            </div>
            <div className="text-right">
              <RiskBadge level={data.level} label={data.level === "safe" ? "Clear" : data.level === "elevated" ? "Medium" : "High Risk"} />
              <div className="mt-1 font-mono text-xl font-bold text-foreground print:text-lg">
                {data.risk.toFixed(1)} / 100
              </div>
              {data.confidence !== undefined && (
                <div className="font-mono text-[10px] text-cyan print:text-[8px]">
                  {(data.confidence * 100).toFixed(0)}% Ensemble Agreement
                </div>
              )}
            </div>
          </div>

          {/* 1. On-Chain Transaction Parameters */}
          <div>
            <h3 className="font-mono text-[11px] uppercase tracking-wider text-cyan mb-2 print:text-[9px]">
              1. On-Chain Transaction Parameters & Execution Telemetry
            </h3>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 rounded-lg border border-border bg-[#0e1832] p-4 text-xs font-mono print:p-2.5 print:text-[9px]">
              <div className="break-all sm:col-span-2">
                <span className="text-muted-foreground block text-[10px] uppercase tracking-wider print:text-[8px]">Transaction Hash</span>
                <span className="text-foreground">{data.hash}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase tracking-wider print:text-[8px]">Block Number</span>
                <span className="text-foreground">
                  {data.block ? `#${data.block.toLocaleString()}` : "Pending / Mainnet Ingestion"}
                </span>
              </div>
              <div className="break-all sm:col-span-1 lg:col-span-2">
                <span className="text-muted-foreground block text-[10px] uppercase tracking-wider print:text-[8px]">From (Sender Wallet)</span>
                <span className="text-foreground">{data.from}</span>
              </div>
              <div className="break-all">
                <span className="text-muted-foreground block text-[10px] uppercase tracking-wider print:text-[8px]">To (Target Contract / Recipient)</span>
                <span className="text-foreground">{data.to}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase tracking-wider print:text-[8px]">Transfer Value</span>
                <span className="text-foreground font-semibold">{data.value} ETH</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase tracking-wider print:text-[8px]">Gas Consumption</span>
                <span className="text-foreground font-semibold">{Number(data.gas).toLocaleString()} gas</span>
              </div>
              {data.latencyMs !== undefined && (
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase tracking-wider print:text-[8px]">Inference Latency</span>
                  <span className="text-foreground font-semibold">{data.latencyMs} ms</span>
                </div>
              )}
            </div>
          </div>

          {/* Token Default Notice (if applicable) */}
          {data.featuresDefaulted && (
            <div className="flex items-center gap-2 rounded-lg border border-warn/40 bg-warn/10 p-3 text-xs text-warn print:p-2 print:text-[9px]">
              <AlertTriangle className="h-4 w-4 shrink-0 print:h-3 print:w-3" />
              <span>
                Scored on gas/value features: sender wallet has no prior ERC-20 token transfer history on Etherscan. Token features imputed safely at baseline neutral zero.
              </span>
            </div>
          )}

          {/* 2. Multi-Model Ensemble Consensus Scorecard */}
          {normalizedScores.length > 0 && (
            <div>
              <h3 className="font-mono text-[11px] uppercase tracking-wider text-cyan mb-2 print:text-[9px]">
                2. Multi-Model Ensemble Consensus Voting Breakdown
              </h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 rounded-lg border border-border bg-[#0e1832] p-4 text-xs font-mono print:p-2.5 print:text-[9px]">
                {normalizedScores.map((m) => (
                  <div
                    key={m.name}
                    className={cn(
                      "flex items-center justify-between rounded border p-2 print:p-1.5",
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

          {/* 3. SHAP Explainability Waterfall Table */}
          {shapItems.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-mono text-[11px] uppercase tracking-wider text-cyan print:text-[9px]">
                  3. Exact SHAP Feature Attributions (Driving Risk Signals)
                </h3>
                <span className="font-mono text-[9px] text-muted-foreground print:text-[8px]">
                  Positive (+): Increases Risk · Negative (-): Mitigates Risk
                </span>
              </div>
              <div className="overflow-hidden rounded-lg border border-border bg-[#0e1832]">
                <table className="w-full text-left font-mono text-xs print:text-[9px]">
                  <thead>
                    <tr className="border-b border-border bg-card text-[10px] uppercase text-muted-foreground print:text-[8px]">
                      <th className="px-3 py-2">Feature Name</th>
                      <th className="px-3 py-2 text-right">Value</th>
                      <th className="px-3 py-2 text-right">SHAP Impact</th>
                      <th className="px-3 py-2">Signal Direction</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {shapItems.map((f, i) => {
                      const shap = typeof f.shap_value === "number" ? f.shap_value : f.contribution || 0;
                      const isPositive = shap > 0;
                      const formattedName = f.feature.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                      return (
                        <tr key={i} className="hover:bg-white/2">
                          <td className="px-3 py-2 font-medium text-foreground">{formattedName}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground">
                            {typeof f.value === "number" ? f.value.toLocaleString() : String(f.value ?? "—")}
                          </td>
                          <td
                            className={cn(
                              "px-3 py-2 text-right font-bold",
                              isPositive ? "text-risk" : "text-safe",
                            )}
                          >
                            {isPositive ? `+${shap.toFixed(3)}` : shap.toFixed(3)}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                "inline-block rounded px-2 py-0.5 text-[9px] font-semibold print:text-[7px]",
                                isPositive ? "bg-risk/15 text-risk" : "bg-safe/15 text-safe",
                              )}
                            >
                              {isPositive ? "▲ Risk Driver" : "▼ Benign Mitigator"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. Action Protocol & Mitigation Recommendations */}
          {data.recommendations && data.recommendations.length > 0 && (
            <div>
              <h3 className="font-mono text-[11px] uppercase tracking-wider text-cyan mb-2 print:text-[9px]">
                4. Operational Security Recommendations & Protocols
              </h3>
              <div className="rounded-lg border border-border bg-[#0e1832] p-4 text-xs font-mono space-y-2 print:p-2.5 print:text-[9px]">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  {data.level === "high" ? (
                    <ShieldAlert className="h-4 w-4 text-risk shrink-0" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 text-safe shrink-0" />
                  )}
                  <span>Action Directive: {data.action ? actionLabel(data.action) : "Standard Operational Protocol"}</span>
                </div>
                <ul className="space-y-1 text-muted-foreground list-disc list-inside">
                  {data.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* 5. Executive Security Verdict Narrative */}
          <div className="rounded-lg border border-border bg-[#0e1832] p-4 text-xs space-y-2 print:p-2.5 print:text-[9px]">
            <h3 className="font-mono text-[11px] uppercase tracking-wider text-cyan print:text-[9px]">
              5. Forensic Verdict Summary & Cryptographic Audit Stamp
            </h3>
            <p className="text-muted-foreground leading-relaxed print:text-[8.5px]">
              This transaction evaluated to an overall risk score of{" "}
              <strong className="text-foreground">{data.risk.toFixed(1)}%</strong> resulting in an executive classification of{" "}
              <strong className="text-foreground">
                {data.level === "safe" ? "CLEAR" : data.level === "elevated" ? "MEDIUM" : "HIGH RISK"}
              </strong>
              . Analysis synthesized across 6 ensemble models (LightGBM, XGBoost, Random Forest, Logistic Regression, PyTorch MLP, FT-Transformer) with exact Shapley value attributions calibrated to 61 on-chain features.
            </p>
          </div>

          {/* Document Footer */}
          <div className="border-t border-border pt-4 text-center font-mono text-[10px] text-muted-foreground print:text-[8px] print:pt-2">
            Aegis AI Fraud Detection System · BCCC-DeFiFraudTrans-2025 Verification Protocol · All Rights Reserved
          </div>
        </div>
      </div>
    </div>
  );
}
