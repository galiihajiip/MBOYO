import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface TimelineEvent {
  id: string;
  title: string;
  /** Rendered in monospace per AGENTS.md typography rule for timestamps. */
  timestamp: string;
  description?: ReactNode;
  actor?: string;
}

export interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
}

/**
 * Vertical event timeline — used for the Auditor's Audit Trail and
 * Laporan Read-Only lineage views (docs/product/SCREEN_INVENTORY.md), and
 * the Reporter's own-report status history. Uses an ordered list (<ol>)
 * for correct sequential semantics for screen readers.
 */
export function Timeline({ events, className }: TimelineProps) {
  return (
    <ol className={cn("relative flex flex-col gap-6 border-l-2 border-brand-border pl-6", className)}>
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span
            aria-hidden="true"
            className="absolute -left-[1.6rem] top-1 h-3 w-3 rounded-full border-2 border-surface-container-lowest bg-brand-ink-navy"
          />
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-sans text-sm font-semibold text-on-surface">
              {event.title}
            </span>
            <time className="font-mono text-xs text-on-surface-variant">{event.timestamp}</time>
          </div>
          {event.actor ? (
            <p className="font-sans text-xs text-on-surface-variant">{event.actor}</p>
          ) : null}
          {event.description ? (
            <div className="mt-1 font-sans text-sm text-on-surface">{event.description}</div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
