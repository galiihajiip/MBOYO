import * as RadixDialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { X } from "./icons/Basic";
import { cn } from "../lib/cn";

export interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

/**
 * Centered modal dialog built on Radix UI (focus trap, Escape-to-close,
 * aria-labelledby/aria-describedby wiring handled by RadixDialog).
 * Level 2 elevation per docs/design/DESIGN_SYSTEM_SPEC.md "Elevation & Depth".
 */
export function Dialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  className,
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger> : null}
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-brand-night/40 data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out" />
        <RadixDialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[min(90vw,32rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface-container-lowest p-6 shadow-[0_8px_24px_rgba(8,32,50,0.08)] focus:outline-none",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <RadixDialog.Title className="font-sans text-xl font-semibold text-on-surface">
                {title}
              </RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-1 font-sans text-sm text-on-surface-variant">
                  {description}
                </RadixDialog.Description>
              ) : null}
            </div>
            <RadixDialog.Close
              aria-label="Tutup"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm text-on-surface-variant hover:bg-brand-mist"
            >
              <X className="h-4 w-4" />
            </RadixDialog.Close>
          </div>
          <div className="mt-4">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
