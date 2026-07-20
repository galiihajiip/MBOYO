import {
  claimPendingItems,
  markConflict,
  markFailed,
  markSynced,
  clearEvidenceAfterConfirmedUpload,
  markLocationSynced,
} from "./queue";
import { withSyncLock } from "./single-flight-lock";
import { getEvidenceBlob } from "./evidence-blobs";
import { SyncError } from "./errors";
import type { ReportDraft } from "../reports/types";
import type { ReportQueueItem } from "./db";

/**
 * Minimal shape this module reads from /api/reports's ApiResult<{report}>
 * envelope (BLOCK 16) — deliberately not importing the real ApiResult/DTO
 * types from lib/api or lib/reports/service, since those are server-only
 * modules and this file also runs inside the service worker bundle
 * (service-worker/sw-src.ts imports runQueueReplay) where "server-only"
 * marked code must never be pulled in.
 */
interface SyncReportsApiResult {
  ok: boolean;
  data: { report: { id: string } };
  error: { code: string; message: string };
}

/**
 * The single, shared queue-replay implementation — per this block's "no
 * duplicate queue implementation" requirement, this module is the only
 * place that claims items and POSTs them to /api/reports. It is called
 * from THREE different trigger points, all converging here:
 *
 *  1. The service worker's `sync` event handler (native Background Sync —
 *     see service-worker/sw-src.ts), when the browser supports it.
 *  2. A `window.addEventListener("online", ...)` fallback in the app
 *     itself (see components/pwa/SyncManager.tsx), for browsers without
 *     Background Sync support (notably non-Chromium), per
 *     docs/adr/0005-offline-indexeddb-workbox.md's documented fallback
 *     requirement.
 *  3. A service-worker-startup fallback (see sw-src.ts's `activate`/
 *     message handling) — if the SW itself restarts (e.g. after being
 *     evicted from memory) while items are still queued, it re-attempts a
 *     replay on next activation rather than waiting indefinitely for a
 *     `sync` event that may never fire again on some platforms.
 *
 * None of these call sites duplicate the claim/POST/mark-outcome logic —
 * they only decide *when* to call runQueueReplay().
 */

export interface SyncProgressEvent {
  type: "sync-started" | "item-started" | "item-succeeded" | "item-failed" | "sync-finished";
  itemId?: string;
  clientReportId?: string;
  totalClaimed?: number;
  succeeded?: number;
  failed?: number;
}

export type SyncProgressListener = (event: SyncProgressEvent) => void;

export interface RunQueueReplayOptions {
  /** Injected fetch so callers (SW vs. window) can each use their own global fetch; also makes this testable. */
  fetchImpl?: typeof fetch;
  onProgress?: SyncProgressListener;
  batchSize?: number;
}

export interface QueueReplaySummary {
  claimed: number;
  succeeded: number;
  failed: number;
  ranAtAll: boolean;
}

/**
 * Runs one replay pass: claims eligible queue items (via the single-flight
 * lock, so a concurrent call from another trigger point or tab is skipped
 * rather than double-processed — see ./single-flight-lock.ts), and POSTs
 * each to /api/reports.
 */
export async function runQueueReplay(options: RunQueueReplayOptions = {}): Promise<QueueReplaySummary> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const batchSize = options.batchSize ?? 5;
  const onProgress = options.onProgress;

  const result = await withSyncLock(async () => {
    const items = await claimPendingItems(batchSize);
    onProgress?.({ type: "sync-started", totalClaimed: items.length });

    let succeeded = 0;
    let failed = 0;

    for (const item of items) {
      onProgress?.({ type: "item-started", itemId: item.id, clientReportId: item.client_report_id });
      try {
        await syncOneItem(item, fetchImpl);
        succeeded += 1;
        onProgress?.({ type: "item-succeeded", itemId: item.id, clientReportId: item.client_report_id });
      } catch (error) {
        failed += 1;
        if (error instanceof SyncError && error.kind === "permanent") {
          await markConflict(item.id, error.message);
        } else {
          await markFailed(item.id, error);
        }
        onProgress?.({ type: "item-failed", itemId: item.id, clientReportId: item.client_report_id });
      }
    }

    onProgress?.({ type: "sync-finished", succeeded, failed });
    return { claimed: items.length, succeeded, failed };
  });

  return result ? { ...result, ranAtAll: true } : { claimed: 0, succeeded: 0, failed: 0, ranAtAll: false };
}

async function syncOneItem(item: ReportQueueItem, fetchImpl: typeof fetch): Promise<void> {
  const draft = JSON.parse(item.payload) as ReportDraft;

  const response = await fetchImpl("/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientReportId: draft.clientReportId,
      eventId: draft.eventId,
      description: draft.description,
      createdAtClient: draft.createdAtClient,
    }),
  });

  // /api/reports returns the shared ApiResult<T> envelope (BLOCK 16,
  // docs/api/REPORTS_API.md) — a body shape of { ok: true, data: { report:
  // {...} } } on success or { ok: false, error: { code, message } } on
  // failure, regardless of HTTP status, so this parses the body once and
  // branches on `ok` rather than on response.ok alone.
  const body = (await response.json().catch(() => null)) as SyncReportsApiResult | null;

  if (!body || !body.ok) {
    const message = body?.error.message ?? `Gagal mengirim laporan (status ${response.status}).`;
    // Every code other than these three retryable ones means retrying
    // without a change (same payload, same report) cannot succeed —
    // mirrors classifyError's default-to-retryable bias for anything not
    // explicitly known to be permanent, applied to the stable ApiErrorCode
    // vocabulary instead of guessing from HTTP status.
    const retryableCodes: ReadonlySet<string> = new Set(["unauthenticated", "rate_limited", "internal_error"]);
    const isPermanent = !body || !retryableCodes.has(body.error.code);
    throw new SyncError(message, isPermanent ? "permanent" : "retryable");
  }

  const serverReportId = body.data.report.id;
  await markSynced(item.id, serverReportId);

  // Upload evidence only after the report row itself is confirmed —
  // uploading first and having the report insert fail would leave an
  // orphaned blob server-side with nothing referencing it.
  if (item.evidence_blob_id) {
    await uploadEvidence(item.evidence_blob_id, serverReportId, fetchImpl);
    await clearEvidenceAfterConfirmedUpload(item.id);
  }

  // Same ordering reasoning as evidence: the location leg only runs once
  // the report row itself exists server-side (record_geolocation_observation
  // requires an existing report_id to attach to). item.location_synced is
  // true for drafts with no captured location at all (see
  // enqueueReport in ./queue.ts) or once this leg has already succeeded on
  // a prior attempt — in both cases there is nothing left to do here.
  if (!item.location_synced && draft.location) {
    await uploadLocation(draft.location, serverReportId, fetchImpl);
    await markLocationSynced(item.id);
  }
}

async function uploadEvidence(evidenceBlobId: string, serverReportId: string, fetchImpl: typeof fetch): Promise<void> {
  const blob = await getEvidenceBlob(evidenceBlobId);
  if (!blob) return; // Already cleared by a prior partial attempt — nothing to upload, not an error.

  const formData = new FormData();
  formData.append("file", blob);
  formData.append("reportId", serverReportId);

  const response = await fetchImpl("/api/reports/evidence", { method: "POST", body: formData });
  if (!response.ok) {
    let body: { error?: string; permanent?: boolean } = {};
    try {
      body = (await response.json()) as typeof body;
    } catch {
      // Non-JSON error body — fall through to the generic message below.
    }
    // The report row itself already synced (markSynced already ran above),
    // so a retry of *this* function only re-attempts the blob upload, not
    // the whole report submission — the evidence endpoint's own `permanent`
    // classification (lib/evidence/errors.ts) tells us whether that retry
    // could ever succeed (e.g. a corrupt file never will) or is worth
    // reattempting (e.g. a transient storage failure).
    const message = body.error ?? "Unggah bukti foto gagal, akan dicoba lagi.";
    throw new SyncError(message, body.permanent === true ? "permanent" : "retryable");
  }
}

/**
 * Minimal shape read from POST /api/reports/:id/location's ApiResult
 * envelope (BLOCK 17, docs/api/REPORTS_API.md) — same "don't import the
 * real server-only types into this SW-bundled module" reasoning as
 * SyncReportsApiResult above.
 */
interface SyncLocationApiResult {
  ok: boolean;
  error?: { code: string; message: string };
}

async function uploadLocation(
  location: ReportDraft["location"],
  serverReportId: string,
  fetchImpl: typeof fetch,
): Promise<void> {
  if (!location) return;

  const response = await fetchImpl(`/api/reports/${serverReportId}/location`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // longitude before latitude — matches submitLocationObservationSchema
    // (@mboyo/domain) and this block's "GeoJSON must use [longitude,
    // latitude]" requirement all the way through to the PostGIS insert.
    body: JSON.stringify({
      longitude: location.longitude,
      latitude: location.latitude,
      accuracyMeters: location.accuracyMeters ?? undefined,
      capturedAtClient: location.capturedAtClient,
      source: location.source,
      manualAddress: location.manualAddress ?? undefined,
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as SyncLocationApiResult | null;
    const message = body?.error?.message ?? "Gagal menyimpan lokasi laporan, akan dicoba lagi.";
    // The report row itself already synced — a retry of this leg only
    // re-attempts recording the location, not the whole submission.
    // validation_failed here would mean the draft's own captured
    // coordinates are out of range, which retrying unchanged cannot fix.
    const isPermanent = body?.error?.code === "validation_failed";
    throw new SyncError(message, isPermanent ? "permanent" : "retryable");
  }
}
