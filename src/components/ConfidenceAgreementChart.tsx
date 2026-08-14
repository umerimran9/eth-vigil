import { Panel } from "@/components/ui-kit";

// Risk probability and model agreement are two different real numbers from
// the same response (assessment.overall_risk_score, assessment.agreement_percentage)
// -- this plots them as one point so the two don't get conflated.
export function ConfidenceAgreementChart({ risk, agreement }: { risk: number; agreement: number }) {
  const x = Math.min(100, Math.max(0, risk));
  const y = Math.min(100, Math.max(0, agreement));
  const px = x;
  const py = 100 - y; // flip so high agreement plots near the top

  return (
    <Panel>
      <h2 className="text-sm font-semibold">Risk vs. agreement</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Different things: a transaction can be high-risk with models split, or low-risk with every model agreed.
      </p>
      <div className="relative mx-auto mt-4 aspect-square w-full max-w-[280px] rounded-md border border-border bg-muted/40">
        <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none" aria-hidden>
          <line x1="50" y1="0" x2="50" y2="100" stroke="var(--border)" strokeWidth="0.6" />
          <line x1="0" y1="50" x2="100" y2="50" stroke="var(--border)" strokeWidth="0.6" />
          <circle cx={px} cy={py} r="3.2" fill="var(--brand)" stroke="var(--card)" strokeWidth="1.2" />
        </svg>
        <span className="absolute left-2 top-1.5 text-[9px] text-muted-foreground">Legitimate · agreed</span>
        <span className="absolute right-2 top-1.5 text-right text-[9px] text-muted-foreground">Fraud · agreed</span>
        <span className="absolute bottom-1.5 left-2 text-[9px] text-muted-foreground">Low signal</span>
        <span className="absolute bottom-1.5 right-2 text-right text-[9px] text-muted-foreground">Model disagreement</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 text-center">
        <div>
          <div className="text-xs text-muted-foreground">Risk</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{x.toFixed(1)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Agreement</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{y.toFixed(1)}%</div>
        </div>
      </div>
    </Panel>
  );
}
