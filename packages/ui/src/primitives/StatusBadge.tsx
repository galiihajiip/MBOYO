import { Badge } from "./Badge";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "critical";

export interface StatusBadgeProps {
  label: string;
  tone: StatusTone;
  className?: string;
}

/**
 * Generic workflow-status badge (report/task status labels from
 * docs/product/CONTENT_GUIDE.md "Report Status Labels" / "Task Status
 * Labels" tables). Callers pass the already-resolved label string (via the
 * label token maps) and a semantic tone — this component itself holds no
 * status-specific logic, keeping status→tone mapping decisions at the call
 * site where the relevant enum is known.
 */
export function StatusBadge({ label, tone, className }: StatusBadgeProps) {
  return (
    <Badge tone={tone} className={className}>
      {label}
    </Badge>
  );
}
