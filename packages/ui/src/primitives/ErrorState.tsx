import type { ReactNode } from "react";
import { AlertTriangle } from "./icons/Basic";
import { cn } from "../lib/cn";

export interface ErrorStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Error state — per docs/product/CONTENT_GUIDE.md "Error Message
 * Conventions": describes what happened and what the user can do next,
 * never a bare technical message. Never used for connectivity loss (that's
 * OnlineStatus/SyncStatus territory) — this is for genuine request/data
 * failures.
 */
export function ErrorState({ title, description, action, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-brand-critical-red/30 bg-brand-critical-red/5 p-8 text-center",
        className,
      )}
    >
      <span className="text-brand-critical-red" aria-hidden="true">
        <AlertTriangle className="h-8 w-8" />
      </span>
      <p className="font-sans text-base font-semibold text-on-surface">{title}</p>
      {description ? (
        <p className="max-w-sm font-sans text-sm text-on-surface-variant">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
