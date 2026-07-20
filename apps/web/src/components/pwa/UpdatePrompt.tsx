"use client";

import { useEffect, useState } from "react";
import { Button } from "@mboyo/ui";

/**
 * Update-available prompt — per docs/product/SCREEN_INVENTORY.md "PWA
 * Update-Available Prompt": non-modal, dismissible, and — critically —
 * NEVER force-reloads automatically. A Reporter mid-wizard with an
 * unsaved-to-server (but safely IndexedDB-persisted) draft must not have
 * their tab yanked out from under them by an update; skipWaiting() is
 * only ever sent after an explicit tap on "Perbarui Sekarang," matching
 * sw-src.ts's message handler, which also only calls self.skipWaiting()
 * on that same explicit signal — never automatically on install.
 */
export function UpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;

    function handleControllerChange() {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    }
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    void navigator.serviceWorker.ready.then((registration) => {
      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
      }
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(installing);
          }
        });
      });
    });

    return () => navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
  }, []);

  if (!waitingWorker || dismissed) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-50 flex w-[min(92vw,28rem)] -translate-x-1/2 items-center justify-between gap-3 rounded-lg border border-brand-border bg-surface-container-lowest p-4 shadow-lg sm:bottom-6"
    >
      <p className="font-sans text-sm text-on-surface">Pembaruan aplikasi tersedia.</p>
      <div className="flex shrink-0 gap-2">
        <Button variant="ghost" onClick={() => setDismissed(true)}>
          Nanti
        </Button>
        <Button onClick={() => waitingWorker.postMessage({ type: "MBOYO_SKIP_WAITING" })}>
          Perbarui Sekarang
        </Button>
      </div>
    </div>
  );
}
