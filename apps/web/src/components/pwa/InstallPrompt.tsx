"use client";

import { useEffect, useState } from "react";
import { Button } from "@mboyo/ui";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_STORAGE_KEY = "mboyo-install-prompt-dismissed";

/**
 * Install prompt — per docs/product/SCREEN_INVENTORY.md "PWA Install
 * Prompt": captures the browser's `beforeinstallprompt` event (Chromium)
 * and shows a custom, dismissible banner rather than relying solely on
 * the browser's own install UI, since that default UI is easy to miss
 * and gives no MBOYO-specific framing. Never blocks the app underneath —
 * always dismissible, and remembers a dismissal for the session via
 * localStorage so it doesn't reappear on every navigation.
 *
 * Standalone-mode detection: if the app is already running installed
 * (display-mode: standalone), this never renders — there is nothing to
 * prompt for.
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    if (localStorage.getItem(DISMISSED_STORAGE_KEY) === "true") return;
    setDismissed(false);

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  function dismiss() {
    setDismissed(true);
    localStorage.setItem(DISMISSED_STORAGE_KEY, "true");
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  }

  if (dismissed || !deferredPrompt) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-50 flex items-center justify-between gap-3 rounded-lg border border-brand-border bg-surface-container-lowest p-4 shadow-lg sm:inset-x-auto sm:right-6 sm:w-[min(92vw,24rem)]"
    >
      <p className="font-sans text-sm text-on-surface">
        Instal MBOYO di perangkat Anda untuk akses lebih cepat, bahkan saat offline.
      </p>
      <div className="flex shrink-0 gap-2">
        <Button variant="ghost" onClick={dismiss}>
          Nanti
        </Button>
        <Button onClick={() => void handleInstall()}>Instal</Button>
      </div>
    </div>
  );
}
