"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, EmptyState, LoadingSkeleton, SyncStatus } from "@mboyo/ui";
import type { QueueStatus, ReportQueueItem } from "../../../lib/offline/db";
import { listQueue, getQueueCounts, retryItem, deleteUnsyncedItem, type QueueCounts } from "../../../lib/offline/queue";
import { getStorageEstimate, type StorageEstimateInfo } from "../../../lib/offline/quota";
import type { ReportDraft } from "../../../lib/reports/types";

const STATUS_TO_SYNC_STATE: Record<QueueStatus, "synced" | "syncing" | "queued" | "failed"> = {
  pending: "queued",
  syncing: "syncing",
  synced: "synced",
  failed: "failed",
  conflict: "failed",
};

const STATUS_LABEL: Record<QueueStatus, string> = {
  pending: "Menunggu sinkronisasi",
  syncing: "Sedang menyinkronkan...",
  synced: "Tersinkronisasi",
  failed: "Gagal — akan dicoba lagi otomatis",
  conflict: "Konflik — perlu ditinjau",
};

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "tidak diketahui";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Antrean Offline — per docs/product/SCREEN_INVENTORY.md: renders entirely
 * from IndexedDB (no network dependency to view), surfaces every queue
 * item's real status (never silently dropping a failed item, per
 * AGENTS.md offline-first invariants), and offers manual retry / delete
 * for items that have not yet synced. Also surfaces the storage estimate
 * (docs/product/RISK_REGISTER.md risk #2) so the Reporter has some
 * visibility into device storage pressure.
 */
export function AntreanOfflineClient() {
  const [items, setItems] = useState<ReportQueueItem[] | null>(null);
  const [counts, setCounts] = useState<QueueCounts | null>(null);
  const [storage, setStorage] = useState<StorageEstimateInfo | null>(null);

  const reload = useCallback(async () => {
    const [queueItems, queueCounts, storageEstimate] = await Promise.all([
      listQueue(),
      getQueueCounts(),
      getStorageEstimate(),
    ]);
    setItems(queueItems);
    setCounts(queueCounts);
    setStorage(storageEstimate);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleRetry(id: string) {
    await retryItem(id);
    await reload();
  }

  async function handleDelete(id: string) {
    await deleteUnsyncedItem(id);
    await reload();
  }

  if (items === null || counts === null) {
    return <LoadingSkeleton lines={4} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-sans text-2xl font-bold text-on-surface">Antrean Offline</h1>

      <div className="flex flex-wrap gap-2">
        <Badge tone="neutral">Menunggu: {counts.pending}</Badge>
        <Badge tone="info">Menyinkronkan: {counts.syncing}</Badge>
        <Badge tone="critical">Gagal/Konflik: {counts.failed + counts.conflict}</Badge>
        <Badge tone="success">Tersinkronisasi: {counts.synced}</Badge>
      </div>

      {storage?.supported ? (
        <p className="font-mono text-xs text-on-surface-variant">
          Penyimpanan digunakan: {formatBytes(storage.usageBytes)} dari {formatBytes(storage.quotaBytes)}
          {storage.persisted ? " · Penyimpanan persisten aktif" : " · Penyimpanan persisten tidak aktif"}
        </p>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title="Tidak ada laporan dalam antrean"
          description="Semua laporan telah tersinkronisasi."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const draft = JSON.parse(item.payload) as ReportDraft;
            return (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-lg border border-brand-border bg-surface-container-lowest p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-sans text-sm font-semibold text-on-surface">
                    {draft.title || "Laporan tanpa judul"}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <SyncStatus state={STATUS_TO_SYNC_STATE[item.status]} />
                    <span className="font-sans text-xs text-on-surface-variant">
                      {STATUS_LABEL[item.status]}
                      {item.attempts > 0 ? ` · Percobaan ke-${item.attempts}` : ""}
                    </span>
                  </div>
                  {item.last_error ? (
                    <p className="mt-1 font-sans text-xs text-brand-critical-red">{item.last_error}</p>
                  ) : null}
                </div>

                {item.status !== "synced" ? (
                  <div className="flex gap-2">
                    {(item.status === "failed" || item.status === "conflict") ? (
                      <Button type="button" variant="secondary" onClick={() => void handleRetry(item.id)}>
                        Coba Lagi
                      </Button>
                    ) : null}
                    <Button type="button" variant="ghost" onClick={() => void handleDelete(item.id)}>
                      Hapus
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

