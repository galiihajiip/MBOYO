"use client";

import * as RadixToast from "@radix-ui/react-toast";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { X } from "./icons/Basic";
import { cn } from "../lib/cn";

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  tone?: "neutral" | "success" | "warning" | "critical";
}

interface ToastContextValue {
  show: (toast: Omit<ToastMessage, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toneClass: Record<NonNullable<ToastMessage["tone"]>, string> = {
  neutral: "border-brand-border bg-surface-container-lowest text-on-surface",
  success: "border-brand-safe-green bg-brand-mist text-on-surface",
  warning: "border-brand-caution-amber bg-brand-mist text-on-surface",
  critical: "border-brand-critical-red bg-brand-mist text-on-surface",
};

/** Wrap the app (or a page subtree) once with this provider to enable useToast(). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const show = useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      <RadixToast.Provider swipeDirection="right">
        {children}
        {toasts.map((toast) => (
          <RadixToast.Root
            key={toast.id}
            duration={6000}
            onOpenChange={(open) => {
              if (!open) dismiss(toast.id);
            }}
            className={cn(
              "flex items-start gap-3 rounded-md border-l-4 p-4 shadow-[0_8px_24px_rgba(8,32,50,0.08)] data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out",
              toneClass[toast.tone ?? "neutral"],
            )}
          >
            <div className="flex-1">
              <RadixToast.Title className="font-sans text-sm font-semibold">
                {toast.title}
              </RadixToast.Title>
              {toast.description ? (
                <RadixToast.Description className="mt-1 font-sans text-sm text-on-surface-variant">
                  {toast.description}
                </RadixToast.Description>
              ) : null}
            </div>
            <RadixToast.Close
              aria-label="Tutup notifikasi"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm text-on-surface-variant hover:bg-brand-mist"
            >
              <X className="h-4 w-4" />
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className="fixed bottom-0 right-0 z-50 flex w-[min(90vw,24rem)] flex-col gap-2 p-4 outline-none" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
