import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface NotificationCardProps {
  title: string;
  description?: string;
  timestamp: string;
  read?: boolean;
  icon?: ReactNode;
  onClick?: () => void;
  className?: string;
}

/**
 * Notification list item — per docs/product/SCREEN_INVENTORY.md "Shared
 * Notifikasi Pattern": navigates to the related entity on click but never
 * exposes a decision action inline (e.g. no confirm/reject button here),
 * so every decision still passes through its full detail screen.
 */
export function NotificationCard({
  title,
  description,
  timestamp,
  read = false,
  icon,
  onClick,
  className,
}: NotificationCardProps) {
  const Component = onClick ? "button" : "div";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex w-full min-h-11 items-start gap-3 rounded-md p-3 text-left",
        onClick && "cursor-pointer hover:bg-brand-mist",
        !read && "bg-surface-container-low",
        className,
      )}
    >
      {!read ? (
        <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-signal-cyan" />
      ) : (
        <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0" />
      )}
      {icon ? <span className="mt-0.5 shrink-0 text-on-surface-variant">{icon}</span> : null}
      <div className="flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              "font-sans text-sm text-on-surface",
              !read && "font-semibold",
            )}
          >
            {title}
          </span>
          <time className="shrink-0 font-mono text-xs text-on-surface-variant">{timestamp}</time>
        </div>
        {description ? (
          <p className="mt-0.5 font-sans text-sm text-on-surface-variant">{description}</p>
        ) : null}
      </div>
    </Component>
  );
}
