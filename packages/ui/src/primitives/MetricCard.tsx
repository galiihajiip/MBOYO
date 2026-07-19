import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: { direction: "up" | "down" | "flat"; label: string };
  icon?: ReactNode;
  className?: string;
}

/**
 * Dashboard metric tile — used across Ringkasan, Command Center, Analitik,
 * Kesehatan Sistem (docs/product/SCREEN_INVENTORY.md). Value rendered in
 * monospace (data-md/lg) per AGENTS.md typography rule for metrics.
 */
export function MetricCard({ label, value, trend, icon, className }: MetricCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-brand-border bg-surface-container-lowest p-4",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-sans text-xs font-bold uppercase tracking-wide text-on-surface-variant">
          {label}
        </span>
        {icon ? <span className="text-on-surface-variant">{icon}</span> : null}
      </div>
      <span className="font-mono text-2xl font-semibold text-on-surface">{value}</span>
      {trend ? (
        <span
          className={cn(
            "font-sans text-sm font-medium",
            trend.direction === "up" && "text-brand-safe-green",
            trend.direction === "down" && "text-brand-critical-red",
            trend.direction === "flat" && "text-on-surface-variant",
          )}
        >
          {trend.label}
        </span>
      ) : null}
    </div>
  );
}
