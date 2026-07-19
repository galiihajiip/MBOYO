import { roleLabels } from "../tokens";
import { Badge } from "./Badge";

export type Role = keyof typeof roleLabels;

export interface RoleBadgeProps {
  role: Role;
  className?: string;
}

const roleTone: Record<Role, "info" | "success" | "priority" | "critical" | "neutral"> = {
  reporter: "neutral",
  verifier: "info",
  response_coordinator: "priority",
  system_administrator: "critical",
  auditor: "success",
};

/** Role badge — label resolved from tokens/labels.ts roleLabels, per docs/product/CONTENT_GUIDE.md. */
export function RoleBadge({ role, className }: RoleBadgeProps) {
  return (
    <Badge tone={roleTone[role]} className={className}>
      {roleLabels[role]}
    </Badge>
  );
}
