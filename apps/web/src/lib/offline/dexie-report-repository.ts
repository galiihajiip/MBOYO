import type { OfflineReportRepository, ReportListItem, SubmitResult } from "../reports/repository";
import type { ReportDraft } from "../reports/types";
import * as draftStore from "./draft-store";
import * as queue from "./queue";
import { saveEvidenceBlob } from "./evidence-blobs";
import { requestPersistentStorage } from "./quota";
import { triggerBackgroundSync } from "./trigger-sync";
import type { QueueStatus } from "./db";

/**
 * Real OfflineReportRepository implementation, replacing
 * ../reports/mock-online-repository.ts entirely. Backed by the Dexie
 * queue/draft/evidence modules in this directory:
 *
 * - saveDraft/getDraft/getLatestUnsubmittedDraft/deleteDraft delegate to
 *   ./draft-store.ts, which persists to IndexedDB — the fix for the mock's
 *   "lost on reload" limitation, satisfying the MVP acceptance criterion
 *   "queue persists after reload."
 * - submitDraft moves the photo Blob into durable evidenceBlobs storage
 *   and enqueues a reportQueue row — idempotent on clientReportId (see
 *   ./queue.ts enqueueReport) so a retried Submit tap never double-queues.
 * - listOwnReports/getOwnReport read from the queue (submitted reports)
 *   merged with any still-in-progress draft, so the Reporter's own-report
 *   screens show a complete picture across both storage layers.
 *
 * This class does NOT itself perform network sync — that is Background
 * Sync/service-worker territory (docs/adr/0005-offline-indexeddb-workbox.md),
 * out of this block's scope; submitDraft's job ends at "reliably queued
 * for sync," matching the offline-first invariant that report creation
 * never depends on a live network call.
 */
export class DexieReportRepository implements OfflineReportRepository {
  constructor() {
    // Best-effort; a denial does not change offline-first behavior, only
    // the likelihood of browser-initiated eviction under storage pressure.
    void requestPersistentStorage();
  }

  saveDraft(draft: ReportDraft): Promise<void> {
    return draftStore.saveDraft(draft);
  }

  getDraft(clientReportId: string): Promise<ReportDraft | null> {
    return draftStore.restoreDraft(clientReportId);
  }

  getLatestUnsubmittedDraft(): Promise<ReportDraft | null> {
    return draftStore.getLatestUnsubmittedDraft();
  }

  async submitDraft(draft: ReportDraft): Promise<SubmitResult> {
    try {
      const evidenceBlobId = draft.photo ? await saveEvidenceBlob(draft.photo.blob) : null;
      await queue.enqueueReport(draft, evidenceBlobId);
      await draftStore.clearDraft(draft.clientReportId);
      void triggerBackgroundSync();
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Laporan tidak dapat disimpan ke antrean lokal.",
      };
    }
  }

  async listOwnReports(): Promise<ReportListItem[]> {
    const items = await queue.listQueue();
    return items.map(toReportListItem);
  }

  async getOwnReport(clientReportId: string): Promise<ReportListItem | null> {
    const items = await queue.listQueue();
    const match = items.find((item) => item.client_report_id === clientReportId);
    return match ? toReportListItem(match) : null;
  }

  async deleteDraft(clientReportId: string): Promise<void> {
    await draftStore.clearDraft(clientReportId);
  }
}

function toReportListItem(item: {
  client_report_id: string;
  payload: string;
  status: QueueStatus;
  updated_at: string;
}): ReportListItem {
  const draft = JSON.parse(item.payload) as ReportDraft;
  return {
    clientReportId: item.client_report_id,
    title: draft.title || "Laporan tanpa judul",
    status: mapQueueStatusToReportStatus(item.status),
    updatedAtClient: item.updated_at,
    observedSeverity: draft.observedSeverity,
  };
}

function mapQueueStatusToReportStatus(status: QueueStatus): ReportListItem["status"] {
  switch (status) {
    case "pending":
      return "queued_offline";
    case "syncing":
      return "syncing";
    case "synced":
      return "submitted";
    case "failed":
    case "conflict":
      return "failed";
  }
}

export const dexieReportRepository = new DexieReportRepository();
