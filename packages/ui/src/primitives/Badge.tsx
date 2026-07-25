import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

/**
 * Generic pill badge — vibrant high-contrast colors readable on both dark & light backgrounds.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-sans text-xs font-bold border tracking-wide shadow-sm",
  {
    variants: {
      tone: {
        neutral: "bg-slate-800/80 text-slate-100 border-slate-600/50",
        info: "bg-brand-signal-cyan/20 text-brand-signal-cyan border-brand-signal-cyan/40",
        success: "bg-brand-safe-green/20 text-emerald-300 border-brand-safe-green/40",
        warning: "bg-brand-caution-amber/20 text-brand-caution-amber border-brand-caution-amber/40",
        priority: "bg-brand-priority-orange/20 text-orange-300 border-brand-priority-orange/40",
        critical: "bg-brand-critical-red/20 text-rose-300 border-brand-critical-red/40",
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
