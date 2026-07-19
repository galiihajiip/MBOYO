import * as RadixSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "./icons/Basic";
import { cn } from "../lib/cn";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

/** Accessible select built on Radix UI — full keyboard nav, screen-reader roles. */
export function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Pilih...",
  disabled,
  ...aria
}: SelectProps) {
  return (
    <RadixSelect.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <RadixSelect.Trigger
        aria-label={aria["aria-label"]}
        className={cn(
          "flex min-h-11 w-full items-center justify-between gap-2 rounded-sm border border-brand-border bg-surface-container-lowest px-3 text-base font-sans text-on-surface data-[placeholder]:text-on-surface-variant disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown className="h-4 w-4" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className="z-50 overflow-hidden rounded-md border border-brand-border bg-surface-container-lowest shadow-lg"
        >
          <RadixSelect.Viewport className="p-1">
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                className="relative flex min-h-11 cursor-pointer select-none items-center rounded-sm px-8 text-base font-sans text-on-surface outline-none data-[highlighted]:bg-brand-mist data-[state=checked]:font-semibold"
              >
                <RadixSelect.ItemIndicator className="absolute left-2 inline-flex items-center">
                  <Check className="h-4 w-4" />
                </RadixSelect.ItemIndicator>
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
