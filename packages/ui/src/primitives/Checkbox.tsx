import * as RadixCheckbox from "@radix-ui/react-checkbox";
import { Check } from "./icons/Basic";
import { cn } from "../lib/cn";

export interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}

/**
 * Accessible checkbox built on Radix UI. Rendered at a 44px hit target
 * (via padding on the wrapping label, not the visual box itself, to keep
 * the visible checkbox at a reasonable 20px while the tap target stays
 * compliant per docs/design/DESIGN_SYSTEM_SPEC.md 44px touch target rule).
 */
export function Checkbox({ className, ...props }: CheckboxProps & { className?: string }) {
  return (
    <RadixCheckbox.Root
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-sm outline-none data-[state=checked]:text-brand-ink-navy",
        className,
      )}
      {...props}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-sm border-2 border-brand-border bg-surface-container-lowest data-[state=checked]:border-brand-ink-navy data-[state=checked]:bg-brand-ink-navy">
        <RadixCheckbox.Indicator className="text-brand-cloud-white">
          <Check className="h-3.5 w-3.5" />
        </RadixCheckbox.Indicator>
      </span>
    </RadixCheckbox.Root>
  );
}
