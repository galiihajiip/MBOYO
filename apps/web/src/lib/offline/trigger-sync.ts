const SYNC_TAG = "mboyo-report-queue-replay";

/**
 * Requests a Background Sync for the report queue — called right after a
 * new item is enqueued (see dexie-report-repository.ts submitDraft), so
 * the browser attempts a sync as soon as it judges connectivity suitable,
 * without waiting for the app to still be open. Falls back to an
 * immediate message-based sync request if Background Sync isn't
 * supported (the SyncManager interface itself is absent) — this still
 * only works while the app is open, which is the expected degraded case
 * for that fallback per docs/architecture/PWA_OFFLINE.md.
 */
export async function triggerBackgroundSync(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.ready.catch(() => null);
  if (!registration) return;

  if ("sync" in registration) {
    try {
      await (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register(
        SYNC_TAG,
      );
      return;
    } catch {
      // Registration can fail (e.g. permission policy) even when the API
      // exists — fall through to the message-based request below rather
      // than leaving the item stuck with no sync attempt at all.
    }
  }

  registration.active?.postMessage({ type: "MBOYO_REQUEST_SYNC" });
}
