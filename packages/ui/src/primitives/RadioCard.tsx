import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

export interface RadioCardProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  description?: string;
  icon?: ReactNode;
}

/**
 * Card-style radio option — native <input type="radio"> under the hood for
 * full accessibility (label association, keyboard nav, screen-reader
 * semantics), styled as a large tappable card per docs/design/DESIGN_SYSTEM_SPEC.md
 * "Shapes" (16-20px radius primary containers).
 */
export const RadioCard = forwardRef<HTMLInputElement, RadioCardProps>(
  ({ className, label, description, icon, id, ...props }, ref) => {
    return (
      <label
        htmlFor={id}
        className={cn(
          "flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border-2 border-brand-border bg-surface-container-lowest p-4 has-[:checked]:border-brand-ink-navy has-[:checked]:bg-brand-mist has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-signal-cyan has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",
          className,
        )}
      >
        <input
          ref={ref}
          id={id}
          type="radio"
          className="peer sr-only"
          {...props}
        />
        {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
        <span className="flex flex-col gap-0.5">
          <span className="font-sans text-base font-semibold text-on-surface">
            {label}
          </span>
          {description ? (
            <span className="font-sans text-sm text-on-surface-variant">
              {description}
            </span>
          ) : null}
        </span>
      </label>
    );
  },
);
RadioCard.displayName = "RadioCard";
