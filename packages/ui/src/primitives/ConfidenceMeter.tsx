import { cn } from "../lib/cn";

export interface ConfidenceMeterProps {
  /** 0..1 confidence value. */
  value: number;
  label: string;
  className?: string;
}

function toneForConfidence(value: number): { bar: string; text: string } {
  if (value >= 0.75) return { bar: "bg-brand-safe-green", text: "text-[#1c7a48]" };
  if (value >= 0.4) return { bar: "bg-brand-caution-amber", text: "text-[#7a5109]" };
  return { bar: "bg-brand-critical-red", text: "text-[#9a2626]" };
}

/**
 * Confidence meter — used for location confidence and quality score in the
 * Verifier's report review screen (docs/product/SCREEN_INVENTORY.md
 * "Antrean Verifikasi — Detail"). Percentage always shown with an explicit
 * unit per docs/product/CONTENT_GUIDE.md formatting conventions, never a
 * bare decimal.
 */
export function ConfidenceMeter({ value, label, className }: ConfidenceMeterProps) {
  const clamped = Math.min(1, Math.max(0, value));
  const percent = Math.round(clamped * 100);
  const tone = toneForConfidence(clamped);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center justify-between">
        <span className="font-sans text-sm text-on-surface-variant">{label}</span>
        <span className={cn("font-mono text-sm font-semibold", tone.text)}>{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high"
      >
        <div
          className={cn("h-full rounded-full", tone.bar)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
