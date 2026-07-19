import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

/**
 * Button variants per docs/design/DESIGN_SYSTEM_SPEC.md "Components > Buttons".
 * All sizes meet the 44px minimum touch target (docs/design/DESIGN_SYSTEM_SPEC.md
 * "Forms & Inputs" 44px touch target requirement, applied system-wide).
 */
const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold font-sans transition-[transform,background-color] duration-150 disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-px",
  {
    variants: {
      variant: {
        primary:
          "bg-brand-ink-navy text-brand-cloud-white hover:bg-brand-deep-ocean",
        secondary:
          "bg-brand-signal-cyan text-brand-night hover:brightness-95",
        success: "bg-brand-safe-green text-brand-night hover:brightness-95",
        warning: "bg-brand-caution-amber text-brand-night hover:brightness-95",
        critical: "bg-brand-critical-red text-brand-cloud-white hover:brightness-95",
        ghost: "bg-transparent text-brand-ink-navy hover:bg-brand-mist",
      },
      size: {
        default: "min-w-11",
        icon: "min-w-11 px-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
