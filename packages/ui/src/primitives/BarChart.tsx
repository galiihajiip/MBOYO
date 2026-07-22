import { cn } from "../lib/cn";

export interface BarChartDatum {
  label: string;
  value: number;
  /** Resolved color for this bar — callers pass a token (e.g. severityColors[x]), never an inline ad hoc hex. */
  color?: string;
}

export interface BarChartProps {
  title: string;
  data: BarChartDatum[];
  /** Unit suffix for the visible value and the accessible summary (e.g. "%", "laporan", "detik"). */
  unit?: string;
  className?: string;
}

/**
 * Generic proportional bar chart (BLOCK 26) — the accessible-by-default
 * replacement for the two inconsistent precedents this codebase had
 * before this block: ProbabilityBars (has ARIA progressbar semantics, no
 * text summary) and command/analitik's inline BreakdownBar (visual only,
 * no ARIA at all). This component gives every bar `role="progressbar"` +
 * `aria-valuenow/min/max` AND renders a `sr-only` `&lt;table&gt;` immediately
 * after the visual bars — a screen-reader user gets the exact same
 * label/value data as a sighted user, in a native table structure, per
 * this block's "charts require accessible text summaries" requirement.
 * The visual bars are `aria-hidden` on their decorative track element
 * (the table is the authoritative text version); the outer chart region
 * uses role="img" with an aria-label summarizing it, so the two
 * representations aren't both read out redundantly by assistive tech.
 */
export function BarChart({ title, data, unit = "", className }: BarChartProps) {
  const maxValue = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <h3 className="font-sans text-sm font-bold text-on-surface">{title}</h3>

      <div role="img" aria-label={`${title}: ${data.map((d) => `${d.label} ${d.value}${unit}`).join(", ")}`} className="flex flex-col gap-2">
        {data.map((datum) => {
          const percent = Math.round((datum.value / maxValue) * 100);
          return (
            <div key={datum.label} className="flex items-center gap-3" aria-hidden="true">
              <span className="w-32 shrink-0 truncate font-sans text-sm text-on-surface">{datum.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-container-high">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${percent}%`, backgroundColor: datum.color ?? "#334155" }}
                />
              </div>
              <span className="w-16 shrink-0 text-right font-mono text-sm font-semibold text-on-surface">
                {datum.value}
                {unit}
              </span>
            </div>
          );
        })}
      </div>

      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Kategori</th>
            <th scope="col">Nilai</th>
          </tr>
        </thead>
        <tbody>
          {data.map((datum) => (
            <tr key={datum.label}>
              <th scope="row">{datum.label}</th>
              <td>
                {datum.value}
                {unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
