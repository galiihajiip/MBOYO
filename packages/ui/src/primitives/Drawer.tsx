import * as RadixDialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { X } from "./icons/Basic";
import { cn } from "../lib/cn";

export interface DrawerProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: string;
  side?: "left" | "right";
  children?: ReactNode;
  className?: string;
}

/**
 * Side drawer — used for desktop/tablet filter panels and collapsible
 * navigation per docs/product/SCREEN_INVENTORY.md (e.g. Peta Bukti,
 * Peta Krisis filter panels). Built on Radix Dialog for the same
 * accessibility guarantees (focus trap, Escape-to-close) as Dialog.
 */
export function Drawer({
  open,
  onOpenChange,
  trigger,
  title,
  side = "right",
  children,
  className,
}: DrawerProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger> : null}
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-brand-night/40" />
        <RadixDialog.Content
          className={cn(
            "fixed top-0 z-50 h-full w-[min(90vw,24rem)] bg-surface-container-lowest p-6 shadow-[0_8px_24px_rgba(8,32,50,0.08)] focus:outline-none",
            side === "right" ? "right-0" : "left-0",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <RadixDialog.Title className="font-sans text-xl font-semibold text-on-surface">
              {title}
            </RadixDialog.Title>
            <RadixDialog.Close
              aria-label="Tutup"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm text-on-surface-variant hover:bg-brand-mist"
            >
              <X className="h-4 w-4" />
            </RadixDialog.Close>
          </div>
          <div className="mt-4 overflow-y-auto">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
