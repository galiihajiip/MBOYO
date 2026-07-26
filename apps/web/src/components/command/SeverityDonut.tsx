import { severityColors, severityLabels } from "@mboyo/ui";
import type { SeverityClass } from "@mboyo/domain";

export interface SeverityDonutProps {
  bySeverity: Partial<Record<SeverityClass, number>>;
}

const ORDER: SeverityClass[] = ["destroyed", "major_damage", "minor_damage", "no_damage", "unknown"];

/**
 * CSS conic-gradient donut of real severity counts (analytics.bySeverity)
 * — the mockup's decorative border-trick "pie chart" replaced with an
 * actual proportional rendering of the same severityColors tokens
 * SeverityBadge uses everywhere else, so this never invents a color
 * mapping the rest of the app doesn't already agree on.
 */
export function SeverityDonut({ bySeverity }: SeverityDonutProps) {
  const total = Object.values(bySeverity).reduce((sum: number, count) => sum + (count ?? 0), 0);

  if (total === 0) {
    return (
      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-8 border-surface-container-high">
        <span className="font-mono text-xs text-on-surface-variant">0</span>
      </div>
    );
  }

  let cumulativePercent = 0;
  const stops: string[] = [];
  for (const severity of ORDER) {
    const count = bySeverity[severity] ?? 0;
    if (count === 0) continue;
    const percent = (count / total) * 100;
    stops.push(`${severityColors[severity]} ${cumulativePercent}% ${cumulativePercent + percent}%`);
    cumulativePercent += percent;
  }

  return (
    <div className="flex items-center gap-6">
      <div
        className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full"
        style={{ background: `conic-gradient(${stops.join(", ")})` }}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-container-lowest">
          <span className="font-mono text-xs font-bold text-on-surface">{total}</span>
        </div>
      </div>
      <div className="flex-1 space-y-1.5">
        {ORDER.filter((severity) => (bySeverity[severity] ?? 0) > 0).map((severity) => (
          <div key={severity} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-sans text-xs text-on-surface">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: severityColors[severity] }} />
              {severityLabels[severity]}
            </span>
            <span className="font-mono text-xs font-semibold text-on-surface-variant">
              {Math.round(((bySeverity[severity] ?? 0) / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
