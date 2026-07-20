"use client";

import { useEffect } from "react";

/**
 * Browser-online fallback trigger — per this block's requirement, for
 * browsers/platforms that don't support the Background Sync API at all
 * (notably Safari as of this writing). Listens for the window `online`
 * event and asks the active service worker to run a replay pass via the
 * message channel (MBOYO_REQUEST_SYNC), reusing the exact same
 * runQueueReplay() logic the native `sync` event would have triggered —
 * per the "no duplicate queue implementation" requirement, this component
 * contains no queue logic of its own, only the trigger.
 *
 * Safe to mount unconditionally: on a browser that DOES support
 * Background Sync, this is a harmless redundant trigger (runQueueReplay's
 * withSyncLock ensures a concurrent native sync-event-triggered replay and
 * this one never double-process the same items).
 */
export function OnlineSyncFallback() {
  useEffect(() => {
    function requestSync() {
      if (!("serviceWorker" in navigator)) return;
      void navigator.serviceWorker.ready.then((registration) => {
        registration.active?.postMessage({ type: "MBOYO_REQUEST_SYNC" });
      });
    }

    window.addEventListener("online", requestSync);
    return () => window.removeEventListener("online", requestSync);
  }, []);

  return null;
}
