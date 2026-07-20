"use client";

import { useEffect } from "react";
import { useToast } from "@mboyo/ui";
import type { QueueReplaySummary, SyncProgressEvent } from "../../lib/offline/sync-replay";

interface SyncCompleteMessage {
  type: "MBOYO_SYNC_COMPLETE";
  trigger: string;
  summary: QueueReplaySummary;
}

interface SyncProgressMessage {
  type: "MBOYO_SYNC_PROGRESS";
  trigger: string;
  progress: SyncProgressEvent;
}

type ServiceWorkerMessage = SyncCompleteMessage | SyncProgressMessage | { type: string };

/**
 * Listens for the service worker's postMessage broadcasts (sw-src.ts's
 * broadcastToClients) and surfaces sync completion as a toast — the "sync
 * progress" requirement's user-visible half. The Antrean Offline screen
 * itself (apps/web/src/app/reporter/antrean/AntreanOfflineClient.tsx)
 * re-reads the queue directly for its own detailed per-item view; this
 * hook is only for the ambient, app-wide "something just synced" signal.
 */
export function useSyncProgress(): void {
  const { show } = useToast();

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    function handleMessage(event: MessageEvent<ServiceWorkerMessage>) {
      const data = event.data;
      if (data.type !== "MBOYO_SYNC_COMPLETE") return;

      const { summary } = data as SyncCompleteMessage;
      if (!summary.ranAtAll || summary.claimed === 0) return;

      if (summary.succeeded > 0 && summary.failed === 0) {
        show({
          title: summary.succeeded === 1 ? "1 laporan berhasil disinkronkan" : `${summary.succeeded} laporan berhasil disinkronkan`,
          tone: "success",
        });
      } else if (summary.failed > 0) {
        show({
          title: "Sebagian laporan gagal disinkronkan",
          description: "Laporan tetap tersimpan dan akan dicoba lagi secara otomatis.",
          tone: "warning",
        });
      }
    }

    navigator.serviceWorker.addEventListener("message", handleMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleMessage);
  }, [show]);
}
