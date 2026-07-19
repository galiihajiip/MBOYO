import { severityColors, severityLabels, type SeverityClass } from "../tokens";
import { cn } from "../lib/cn";

export interface SeverityBadgeProps {
  severity: SeverityClass;
  className?: string;
}

/**
 * Severity badge — color and label resolved exclusively from
 * packages/ui/src/tokens (severityColors / severityLabels), never an
 * inline hex value or hardcoded string, per docs/product/CONTENT_GUIDE.md
 * "Severity Labels" table and the "no duplicated inline severity colors"
 * requirement.
 */
export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const color = severityColors[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-sans text-sm font-semibold",
        className,
      )}
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
        color: darkenForText(color),
      }}
    >
      <span
        aria-hidden="true"
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {severityLabels[severity]}
    </span>
  );
}

/**
 * Severity badges always pair color with the label text (never color
 * alone), and darken the token color for the text itself so it reads at
 * sufficient contrast against the 15%-tint background — matching the
 * amber-readability requirement extended to every severity tone, not just
 * caution/amber specifically.
 */
function darkenForText(hex: string): string {
  return `color-mix(in srgb, ${hex} 65%, black)`;
}
