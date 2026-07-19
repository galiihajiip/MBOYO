import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

/**
 * Generic pill badge — the base every semantic badge (SeverityBadge,
 * StatusBadge, RoleBadge) builds on, per docs/design/DESIGN_SYSTEM_SPEC.md
 * "Status & Severity Badges" (fully rounded pill shape).
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-sans text-sm font-semibold",
  {
    variants: {
      tone: {
        neutral: "bg-brand-mist text-brand-slate",
        info: "bg-brand-signal-cyan/15 text-brand-deep-ocean",
        success: "bg-brand-safe-green/15 text-[#1c7a48]",
        warning: "bg-brand-caution-amber/20 text-[#7a5109]",
        priority: "bg-brand-priority-orange/15 text-[#b8531f]",
        critical: "bg-brand-critical-red/15 text-[#9a2626]",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
