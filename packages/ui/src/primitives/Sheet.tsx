import * as RadixDialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title?: string;
  children?: ReactNode;
  className?: string;
}

/**
 * Mobile bottom sheet — per docs/product/SCREEN_INVENTORY.md mobile
 * responsive hierarchy notes (e.g. filters, pin-detail previews on
 * Peta Bukti/Peta Krisis). Includes a drag-handle affordance and slides
 * up from the bottom; built on Radix Dialog for focus-trap/Escape parity.
 */
export function Sheet({ open, onOpenChange, trigger, title, children, className }: SheetProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger> : null}
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-brand-night/40" />
        <RadixDialog.Content
          className={cn(
            "fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] rounded-t-xl bg-surface-container-lowest p-6 pb-8 shadow-[0_8px_24px_rgba(8,32,50,0.08)] focus:outline-none",
            className,
          )}
        >
          <div
            aria-hidden="true"
            className="mx-auto mb-4 h-1 w-10 rounded-full bg-brand-border"
          />
          {title ? (
            <RadixDialog.Title className="font-sans text-xl font-semibold text-on-surface">
              {title}
            </RadixDialog.Title>
          ) : (
            <RadixDialog.Title className="sr-only">Panel</RadixDialog.Title>
          )}
          <div className="mt-4 overflow-y-auto">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
