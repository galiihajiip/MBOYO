"use client";

import { useEffect } from "react";
import { useSyncProgress } from "./useSyncProgress";
import { UpdatePrompt } from "./UpdatePrompt";
import { InstallPrompt } from "./InstallPrompt";

/**
 * Registers public/sw.js (built by scripts/build-sw.ts) and mounts the
 * install/update prompts. Deliberately does nothing in development —
 * NEXT_PUBLIC_APP_ENV !== "production" skips registration entirely, since
 * a caching service worker actively fights Next.js's dev-mode HMR/fast
 * refresh (stale cached JS chunks served instead of the freshly rebuilt
 * ones). See docs/architecture/PWA_OFFLINE.md.
 */
export function ServiceWorkerRegistration() {
  useSyncProgress();

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_APP_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.error("[mboyo] service worker registration failed", error);
    });
  }, []);

  return (
    <>
      <UpdatePrompt />
      <InstallPrompt />
    </>
  );
}
