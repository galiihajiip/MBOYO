import type { ReactNode } from "react";
import { Inbox } from "./icons/Basic";
import { cn } from "../lib/cn";

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/**
 * Empty state — per docs/product/CONTENT_GUIDE.md "Empty State Conventions":
 * many MBOYO empty states are positive (empty Verifier queue, empty offline
 * queue), so this component is deliberately neutral/calm in tone rather than
 * "sad" iconography, and never fabricates placeholder data to avoid showing.
 */
export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed border-brand-border p-8 text-center",
        className,
      )}
    >
      <span className="text-on-surface-variant" aria-hidden="true">
        {icon ?? <Inbox className="h-8 w-8" />}
      </span>
      <p className="font-sans text-base font-semibold text-on-surface">{title}</p>
      {description ? (
        <p className="max-w-sm font-sans text-sm text-on-surface-variant">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
