"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  EmptyState,
  LoadingSkeleton,
  Sync,
  Pencil,
  Trash,
  RotateCw,
  HardDrive,
  Zap,
  CheckCircle,
  FileText,
} from "@mboyo/ui";
import type { QueueStatus, ReportQueueItem } from "../../../lib/offline/db";
import { listQueue, getQueueCounts, retryItem, deleteUnsyncedItem, type QueueCounts } from "../../../lib/offline/queue";
import { getEvidenceBlob } from "../../../lib/offline/evidence-blobs";
import { getStorageEstimate, type StorageEstimateInfo } from "../../../lib/offline/quota";
import { triggerBackgroundSync } from "../../../lib/offline/trigger-sync";
import type { ReportDraft } from "../../../lib/reports/types";

const STATUS_TONE: Record<QueueStatus, "neutral" | "info" | "success" | "critical"> = {
  pending: "neutral",
  syncing: "info",
  synced: "success",
  failed: "critical",
  conflict: "critical",
};

const STATUS_LABEL: Record<QueueStatus, string> = {
  pending: "Menunggu",
  syncing: "Mengirim",
  synced: "Tersinkronisasi",
  failed: "Gagal",
  conflict: "Konflik",
};

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "tidak diketahui";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

function QueueThumbnail({ evidenceBlobId }: { evidenceBlobId: string | null }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!evidenceBlobId) return;
    let objectUrl: string | null = null;
    void getEvidenceBlob(evidenceBlobId).then((blob) => {
      if (blob) {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      }
    });
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [evidenceBlobId]);

  if (!url) {
    return (
      <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg border border-brand-border bg-surface-container-high text-on-surface-variant">
        <FileText className="h-4 w-4" />
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element -- local blob preview URL, not an optimizable remote/static image
  return <img src={url} alt="Pratinjau bukti foto" className="h-12 w-16 shrink-0 rounded-lg border border-brand-border object-cover" />;
}

/**
 * Antrean Offline — per docs/product/SCREEN_INVENTORY.md: renders entirely
 * from IndexedDB (no network dependency to view), surfaces every queue
 * item's real status (never silently dropping a failed item, per
 * AGENTS.md offline-first invariants), and offers manual retry / delete
 * for items that have not yet synced. Also surfaces the storage estimate
 * (docs/product/RISK_REGISTER.md risk #2) so the Reporter has some
 * visibility into device storage pressure.
 *
 * "Sinkronkan Sekarang" calls the same triggerBackgroundSync() the SW's
 * native sync event and the online-fallback listener already use (see
 * that function's own comment) — this button is a third, explicit trigger
 * point, not a separate sync implementation.
 */
export function AntreanOfflineClient() {
  const [items, setItems] = useState<ReportQueueItem[] | null>(null);
  const [counts, setCounts] = useState<QueueCounts | null>(null);
  const [storage, setStorage] = useState<StorageEstimateInfo | null>(null);
  const [syncing, setSyncing] = useState(false);

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

  async function handleSyncNow() {
    setSyncing(true);
    try {
      await triggerBackgroundSync();
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await reload();
    } finally {
      setSyncing(false);
    }
  }

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

  const unsyncedCount = counts.pending + counts.syncing + counts.failed + counts.conflict;
  const storagePercent =
    storage?.supported && storage.usageBytes !== null && storage.quotaBytes
      ? Math.min(100, Math.round((storage.usageBytes / storage.quotaBytes) * 100))
      : null;

  return (
    <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
      <div className="flex-1">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge tone="warning" className="mb-2">
              Buffer Lokal
            </Badge>
            <h1 className="font-sans text-2xl font-bold text-on-surface sm:text-3xl">Antrean Sinkronisasi</h1>
            <p className="mt-1 font-sans text-sm text-on-surface-variant">
              Mengelola laporan bencana yang tersimpan secara lokal saat offline.
            </p>
          </div>
          <Button type="button" onClick={() => void handleSyncNow()} disabled={syncing || unsyncedCount === 0} className="gap-2">
            <Sync className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Menyinkronkan..." : "Sinkronkan Sekarang"}
          </Button>
        </div>

        {items.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="Tidak ada laporan dalam antrean"
              description="Semua laporan telah tersinkronisasi."
              icon={<CheckCircle className="h-8 w-8" />}
            />
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-brand-border bg-surface-container-lowest shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="border-b border-brand-border bg-surface-container-low">
                  <tr>
                    <th className="p-4 font-sans text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                      Pratinjau
                    </th>
                    <th className="p-4 font-sans text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                      Judul Laporan
                    </th>
                    <th className="p-4 font-sans text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                      ID Lokal
                    </th>
                    <th className="p-4 font-sans text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                      Status
                    </th>
                    <th className="p-4 text-right font-sans text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {items.map((item) => {
                    const draft = JSON.parse(item.payload) as ReportDraft;
                    return (
                      <tr key={item.id} className="hover:bg-brand-mist/40">
                        <td className="p-4">
                          <QueueThumbnail evidenceBlobId={item.evidence_blob_id} />
                        </td>
                        <td className="p-4">
                          <p className="font-sans text-sm font-bold text-on-surface">
                            {draft.title || "Laporan tanpa judul"}
                          </p>
                          <p className="font-sans text-xs text-on-surface-variant">{draft.eventName ?? "—"}</p>
                          {item.last_error ? (
                            <p className="mt-1 font-sans text-xs text-brand-critical-red">{item.last_error}</p>
                          ) : null}
                        </td>
                        <td className="p-4 font-mono text-xs text-brand-deep-ocean">MBO-{shortId(item.id)}</td>
                        <td className="p-4">
                          <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
                          {item.attempts > 0 ? (
                            <p className="mt-1 font-sans text-[11px] text-on-surface-variant">
                              Percobaan ke-{item.attempts}
                            </p>
                          ) : null}
                        </td>
                        <td className="p-4">
                          <div className="flex justify-end gap-1.5">
                            {item.status === "failed" || item.status === "conflict" ? (
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => void handleRetry(item.id)}
                                className="min-h-9 gap-1.5 px-3 text-xs"
                              >
                                <RotateCw className="h-3.5 w-3.5" />
                                Coba Lagi
                              </Button>
                            ) : item.status === "pending" ? (
                              <button
                                type="button"
                                title="Edit"
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-signal-cyan hover:bg-brand-signal-cyan/10"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            ) : null}
                            {item.status !== "synced" ? (
                              <button
                                type="button"
                                title="Hapus"
                                onClick={() => void handleDelete(item.id)}
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-brand-critical-red hover:bg-brand-critical-red/10"
                              >
                                <Trash className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-brand-border bg-surface-container-low p-5">
            <p className="font-sans text-xs font-bold uppercase tracking-wide text-on-surface-variant">Total Antrean</p>
            <p className="mt-1 font-mono text-2xl font-bold text-brand-ink-navy">
              {String(unsyncedCount).padStart(2, "0")}{" "}
              <span className="font-sans text-sm font-normal text-on-surface-variant">Laporan Menunggu</span>
            </p>
          </div>
          <div className="rounded-2xl border border-brand-border bg-surface-container-low p-5">
            <p className="font-sans text-xs font-bold uppercase tracking-wide text-on-surface-variant">
              Penyimpanan Digunakan
            </p>
            <p className="mt-1 font-mono text-2xl font-bold text-brand-ink-navy">
              {formatBytes(storage?.usageBytes ?? null)}{" "}
              <span className="font-sans text-sm font-normal text-on-surface-variant">
                dari {formatBytes(storage?.quotaBytes ?? null)}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Sidebar: Status Sistem */}
      <aside className="w-full shrink-0 xl:w-[300px]">
        <div className="flex flex-col gap-4">
          <h2 className="font-sans text-base font-bold text-on-surface">Status Sistem</h2>

          <div className="rounded-2xl border border-brand-border bg-surface-container-low p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-sans text-xs font-bold uppercase tracking-wide text-on-surface">
                <HardDrive className="h-4 w-4" />
                Storage Quota
              </span>
              {storagePercent !== null ? (
                <span className="font-mono text-sm font-bold text-brand-ink-navy">{storagePercent}%</span>
              ) : null}
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container-high">
              <div className="h-full rounded-full bg-brand-ink-navy" style={{ width: `${storagePercent ?? 0}%` }} />
            </div>
            <div className="mt-2 flex justify-between font-mono text-[11px] font-bold text-on-surface-variant">
              <span>{formatBytes(storage?.usageBytes ?? null).toUpperCase()} USED</span>
              <span>{formatBytes(storage?.quotaBytes ?? null).toUpperCase()} TOTAL</span>
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-brand-border bg-surface-container-lowest p-4">
            <div className="flex items-start gap-3">
              <Zap className="mt-0.5 h-5 w-5 shrink-0 text-brand-caution-amber" />
              <div>
                <p className="font-sans text-sm font-bold text-on-surface">Sinkronisasi Otomatis</p>
                <p className="mt-1 font-sans text-xs leading-relaxed text-on-surface-variant">
                  Sistem akan otomatis mengunggah saat koneksi terdeteksi stabil.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-brand-relief-teal/15 p-4">
            <p className="font-sans text-[11px] font-bold uppercase tracking-widest text-brand-relief-teal">
              Tips Lapangan
            </p>
            <p className="mt-1 font-sans text-sm leading-snug text-on-surface">
              Kurangi ukuran resolusi foto jika sinyal di lokasi sangat lemah.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-surface-container-high px-4 py-3">
            <span className="flex items-center gap-2 font-sans text-xs font-bold text-on-surface">
              <CheckCircle className="h-4 w-4 text-brand-safe-green" />
              Database Luring OK
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
}
