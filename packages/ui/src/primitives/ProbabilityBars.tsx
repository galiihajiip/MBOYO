import { severityColors, severityLabels, type SeverityClass } from "../tokens";
import { cn } from "../lib/cn";

export interface ProbabilityBarsProps {
  /** Probability per severity class, 0..1, per model_prediction.severity_probabilities. */
  probabilities: Record<SeverityClass, number>;
  className?: string;
}

/**
 * Renders the model's per-class severity probabilities as horizontal bars —
 * the core visualization on the Verifier's decision screen
 * (docs/product/SCREEN_INVENTORY.md "Antrean Verifikasi — Detail"). Colors
 * resolved exclusively from tokens/colors.ts severityColors, never inline.
 */
export function ProbabilityBars({ probabilities, className }: ProbabilityBarsProps) {
  const order = Object.keys(severityLabels) as SeverityClass[];

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {order.map((severity) => {
        const value = probabilities[severity] ?? 0;
        const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
        const color = severityColors[severity];

        return (
          <div key={severity} className="flex items-center gap-3">
            <span className="w-32 shrink-0 font-sans text-sm text-on-surface">
              {severityLabels[severity]}
            </span>
            <div
              role="progressbar"
              aria-label={severityLabels[severity]}
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 flex-1 overflow-hidden rounded-full bg-surface-container-high"
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${percent}%`, backgroundColor: color }}
              />
            </div>
            <span className="w-12 shrink-0 text-right font-mono text-sm font-semibold text-on-surface">
              {percent}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
