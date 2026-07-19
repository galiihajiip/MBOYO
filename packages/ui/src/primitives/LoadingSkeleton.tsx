import { cn } from "../lib/cn";

export interface LoadingSkeletonProps {
  className?: string;
  /** Number of stacked skeleton lines to render (e.g. for a list). */
  lines?: number;
}

/**
 * Loading placeholder. Uses `animate-pulse` which is neutralized under
 * `prefers-reduced-motion` by the reduced-motion base rule in styles.css,
 * so no per-component reduced-motion handling is needed here.
 */
export function LoadingSkeleton({ className, lines = 1 }: LoadingSkeletonProps) {
  if (lines > 1) {
    return (
      <div className="flex flex-col gap-2" role="status" aria-label="Memuat...">
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className={cn(
              "h-4 animate-pulse rounded-sm bg-surface-container-high",
              className,
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label="Memuat..."
      className={cn("h-4 animate-pulse rounded-sm bg-surface-container-high", className)}
    />
  );
}
