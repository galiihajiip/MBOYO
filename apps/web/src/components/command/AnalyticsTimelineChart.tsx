"use client";

import { useState } from "react";
import type { TimelinePoint } from "@mboyo/domain";

export interface AnalyticsTimelineChartProps {
  data: TimelinePoint[];
}

/**
 * Bar chart of daily report submissions over the window from
 * getSubmissionTimeline — a real-data replacement for the mockup's
 * "Frequency vs. Verification Speed" chart, which paired frequency with a
 * fabricated verification-speed line this schema has no per-day series
 * for. Kept to the one series this codebase can actually compute per day.
 */
export function AnalyticsTimelineChart({ data }: AnalyticsTimelineChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const maxValue = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className="h-full overflow-x-auto">
      <div
        role="img"
        aria-label={`Garis waktu pengiriman laporan: ${data.map((d) => `${d.date} ${d.count} laporan`).join(", ")}`}
        className="flex h-full min-w-[560px] items-stretch gap-1.5 sm:min-w-0"
      >
        {data.map((point, i) => {
          const heightPercent = Math.max(4, Math.round((point.count / maxValue) * 100));
          const isHovered = hoverIndex === i;
          return (
            <div
              key={point.date}
              className="group relative flex flex-1 flex-col justify-end gap-1"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
            >
              {isHovered ? (
                <div className="absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-brand-ink-navy px-2 py-1 font-mono text-[10px] text-white">
                  {point.count} laporan
                </div>
              ) : null}
              <div className="flex flex-1 items-end">
                <div
                  className={`w-full rounded-t-sm transition-colors ${isHovered ? "bg-brand-signal-cyan" : "bg-brand-signal-cyan/30"}`}
                  style={{ height: `${heightPercent}%` }}
                />
              </div>
              <span className="text-center font-mono text-[9px] uppercase text-on-surface-variant">
                {new Date(point.date).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit" })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
