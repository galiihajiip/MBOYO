"use client";

import { useEffect, useState } from "react";
import { OnlineStatus } from "@mboyo/ui";

/**
 * Live online/offline indicator for the topbar. Per
 * docs/product/SCREEN_INVENTORY.md "Global Offline Banner" and
 * docs/product/CONTENT_GUIDE.md: must reflect actual connectivity, not be
 * silently wrong. Uses the browser `online`/`offline` events (reflecting
 * navigator.onLine) as the baseline signal — a fuller "verify via actual
 * request success/failure" check (e.g. a periodic health-endpoint probe)
 * is deferred to the Reporter offline-queue block where it has real
 * traffic to observe; this component does not claim more precision than it has.
 */
export function ConnectivityIndicator() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return <OnlineStatus online={online} />;
}
