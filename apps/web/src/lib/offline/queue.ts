import { getOfflineDb, type QueueStatus, type ReportQueueItem } from "./db";
import { computeNextRetryAt } from "./backoff";
import { classifyError } from "./errors";
import type { ReportDraft } from "../reports/types";

export interface EnqueueResult {
  /** True if this call created a new queue row; false if client_report_id already existed (idempotent no-op-on-conflict). */
  created: boolean;
  item: ReportQueueItem;
}

/**
 * Enqueues a submitted draft. Idempotent on client_report_id: calling this
 * twice with the same draft (e.g. a retried Submit tap, or the wizard's
 * Submit step re-firing after a component remount) never creates a second
 * queue row — this is the client-side half of the idempotency guarantee
 * described in docs/architecture/SEQUENCE_FLOWS.md Diagram 3 (the other
 * half being the server's upsert-on-dedupe_key).
 */
export async function enqueueReport(
  draft: ReportDraft,
  evidenceBlobId: string | null,
): Promise<EnqueueResult> {
  const db = getOfflineDb();

  const existing = await db.reportQueue.where("client_report_id").equals(draft.clientReportId).first();
  if (existing) {
    return { created: false, item: existing };
  }

  const now = new Date().toISOString();
  const item: ReportQueueItem = {
    id: crypto.randomUUID(),
    client_report_id: draft.clientReportId,
    event_id: draft.eventId,
    payload: JSON.stringify(draft),
    evidence_blob_id: evidenceBlobId,
    status: "pending",
    attempts: 0,
    last_error: null,
    next_retry_at: null,
    created_at: now,
    updated_at: now,
    server_report_id: null,
    // Vacuously true when the draft never captured a location at all —
    // there is nothing for the location sync leg to do, so it should never
    // be treated as an outstanding/retryable step.
    location_synced: draft.location === null,
  };

  try {
    await db.reportQueue.add(item);
  } catch (error) {
    // A unique-constraint violation here means a concurrent enqueue (e.g.
    // two tabs) won the race between our existence check and our add —
    // re-read and return the winner rather than surfacing a spurious
    // duplicate-key error to the caller.
    const winner = await db.reportQueue.where("client_report_id").equals(draft.clientReportId).first();
    if (winner) return { created: false, item: winner };
    throw error;
  }

  return { created: true, item };
}

export interface QueueCounts {
  pending: number;
  syncing: number;
  failed: number;
  synced: number;
  conflict: number;
  total: number;
}

export async function getQueueCounts(): Promise<QueueCounts> {
  const db = getOfflineDb();
  const all = await db.reportQueue.toArray();
  const counts: QueueCounts = { pending: 0, syncing: 0, failed: 0, synced: 0, conflict: 0, total: all.length };
  for (const item of all) {
    counts[item.status] += 1;
  }
  return counts;
}

/** Lists queue items, most recently updated first — powers the Antrean Offline screen. */
export async function listQueue(statusFilter?: QueueStatus[]): Promise<ReportQueueItem[]> {
  const db = getOfflineDb();
  const all = await db.reportQueue.orderBy("updated_at").reverse().toArray();
  if (!statusFilter) return all;
  return all.filter((item) => statusFilter.includes(item.status));
}

/**
 * Atomically claims up to `limit` items eligible for sync right now —
 * status `pending`, or `failed` items whose next_retry_at has elapsed —
 * and marks them `syncing`. `conflict` items are deliberately never
 * auto-claimed (see markConflict's doc comment: a conflict requires
 * explicit resolution via retryItem, which resets status back to
 * `pending` first). Runs inside a Dexie transaction so the read-then-write
 * is atomic within this JS realm; cross-tab exclusivity is provided by the
 * caller wrapping this in withSyncLock (see ./single-flight-lock.ts),
 * which is the actual "safe locking" mechanism — this function alone only
 * prevents a single caller from double-claiming within one transaction,
 * not concurrent callers across tabs.
 */
export async function claimPendingItems(limit = 5): Promise<ReportQueueItem[]> {
  const db = getOfflineDb();
  const now = new Date().toISOString();

  return db.transaction("rw", db.reportQueue, async () => {
    const candidates = await db.reportQueue
      .where("status")
      .anyOf("pending", "failed")
      .filter((item) => item.status === "pending" || !item.next_retry_at || item.next_retry_at <= now)
      .limit(limit)
      .toArray();

    const claimed: ReportQueueItem[] = [];
    for (const item of candidates) {
      const updated: ReportQueueItem = { ...item, status: "syncing", updated_at: now };
      await db.reportQueue.put(updated);
      claimed.push(updated);
    }
    return claimed;
  });
}

export async function markSyncing(id: string): Promise<void> {
  const db = getOfflineDb();
  await db.reportQueue.update(id, { status: "syncing", updated_at: new Date().toISOString() });
}

export async function markSynced(id: string, serverReportId: string): Promise<void> {
  const db = getOfflineDb();
  await db.reportQueue.update(id, {
    status: "synced",
    server_report_id: serverReportId,
    last_error: null,
    next_retry_at: null,
    updated_at: new Date().toISOString(),
  });
  await recordSyncAttempt(id, "success", null, null);
}

/**
 * Marks an item failed after a sync attempt. Never deletes or discards the
 * item's payload/evidence — "preserve failed data" per this block's
 * requirement — only status/attempts/last_error/next_retry_at change.
 * Schedules an automatic retry (via next_retry_at) only for retryable
 * errors; a permanent error still leaves the item visible/retryable
 * manually (retryItem) but claimPendingItems will not pick it up on its own
 * since next_retry_at is left null for permanent failures.
 */
export async function markFailed(id: string, error: unknown): Promise<void> {
  const db = getOfflineDb();
  const item = await db.reportQueue.get(id);
  if (!item) return;

  const classified = classifyError(error);
  const attempts = item.attempts + 1;
  const nextRetryAt = classified.kind === "retryable" ? computeNextRetryAt(attempts) : null;

  await db.reportQueue.update(id, {
    status: "failed",
    attempts,
    last_error: classified.message,
    next_retry_at: nextRetryAt,
    updated_at: new Date().toISOString(),
  });
  await recordSyncAttempt(id, "failure", classified.message, classified.kind);
}

/**
 * Marks an item as a genuine conflict (e.g. the server reports the
 * dedupe_key already resolved to a *different* report than expected — a
 * scenario distinct from an ordinary retryable failure, per this block's
 * queue-status spec including "conflict" as its own state rather than
 * folding it into "failed"). Conflicts are never auto-retried; they
 * require the Reporter (or a future reconciliation UI) to resolve
 * explicitly via retryItem or deleteUnsyncedItem.
 */
export async function markConflict(id: string, reason: string): Promise<void> {
  const db = getOfflineDb();
  await db.reportQueue.update(id, {
    status: "conflict",
    last_error: reason,
    next_retry_at: null,
    updated_at: new Date().toISOString(),
  });
  await recordSyncAttempt(id, "failure", reason, "permanent");
}

/**
 * Manual retry — resets an item to `pending` with next_retry_at cleared so
 * the next claimPendingItems pass picks it up immediately, regardless of
 * how it got into failed/conflict state. Does not reset `attempts`, so the
 * backoff history (and the Reporter-visible attempt count) is preserved.
 */
export async function retryItem(id: string): Promise<void> {
  const db = getOfflineDb();
  await db.reportQueue.update(id, { status: "pending", next_retry_at: null, updated_at: new Date().toISOString() });
}

/**
 * Deletes an item that has not yet synced — used by the Antrean Offline
 * screen when the Reporter explicitly chooses to discard a queued/failed
 * report. Never deletes a `synced` item through this path (see
 * pruneSynced for that, which is a separate, deliberate cleanup
 * operation) — a synced item is the durable record of a real submission
 * and must not be casually removable.
 */
export async function deleteUnsyncedItem(id: string): Promise<void> {
  const db = getOfflineDb();
  await db.transaction("rw", db.reportQueue, db.evidenceBlobs, async () => {
    const item = await db.reportQueue.get(id);
    if (!item || item.status === "synced") return;
    if (item.evidence_blob_id) {
      await db.evidenceBlobs.delete(item.evidence_blob_id);
    }
    await db.reportQueue.delete(id);
  });
}

const SYNCED_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * "Delayed cleanup after sync": a synced item's queue row (and its
 * evidence blob) are kept for SYNCED_RETENTION_MS after synced so the
 * Reporter's Antrean Offline / Laporan Saya screens can still show recent
 * successful submissions without an extra server round-trip, then pruned.
 * This is a deliberate delay, not immediate cleanup on sync — see
 * clearEvidenceAfterConfirmedUpload for the (earlier, blob-only) cleanup
 * that happens right at sync confirmation.
 */
export async function pruneSynced(now: Date = new Date()): Promise<number> {
  const db = getOfflineDb();
  const cutoff = new Date(now.getTime() - SYNCED_RETENTION_MS).toISOString();

  return db.transaction("rw", db.reportQueue, db.evidenceBlobs, async () => {
    const stale = await db.reportQueue
      .where("status")
      .equals("synced")
      .filter((item) => item.updated_at <= cutoff)
      .toArray();

    for (const item of stale) {
      if (item.evidence_blob_id) {
        await db.evidenceBlobs.delete(item.evidence_blob_id);
      }
      await db.reportQueue.delete(item.id);
    }
    return stale.length;
  });
}

/**
 * Deletes only the evidence blob for a queue item once the server has
 * confirmed the upload succeeded — the queue row itself stays (status
 * synced) until pruneSynced's later, delayed cleanup. Freeing the (often
 * multi-megabyte) blob immediately on confirmed upload matters more for
 * device storage pressure than freeing the small queue-row metadata does.
 */
export async function clearEvidenceAfterConfirmedUpload(queueItemId: string): Promise<void> {
  const db = getOfflineDb();
  const item = await db.reportQueue.get(queueItemId);
  if (!item?.evidence_blob_id) return;
  await db.evidenceBlobs.delete(item.evidence_blob_id);
  await db.reportQueue.update(queueItemId, { evidence_blob_id: null, updated_at: new Date().toISOString() });
}

/**
 * Marks a queue item's location leg confirmed recorded server-side (BLOCK
 * 17) — the location analogue of clearEvidenceAfterConfirmedUpload, so a
 * retried sync pass never re-POSTs the same draft's location and creates a
 * duplicate geolocation_observation row.
 */
export async function markLocationSynced(queueItemId: string): Promise<void> {
  const db = getOfflineDb();
  await db.reportQueue.update(queueItemId, { location_synced: true, updated_at: new Date().toISOString() });
}

async function recordSyncAttempt(
  queueItemId: string,
  outcome: "success" | "failure",
  errorMessage: string | null,
  errorKind: "retryable" | "permanent" | null,
): Promise<void> {
  const db = getOfflineDb();
  const item = await db.reportQueue.get(queueItemId);
  const now = new Date().toISOString();
  await db.syncAttempts.add({
    id: crypto.randomUUID(),
    queue_item_id: queueItemId,
    attempt_number: item?.attempts ?? 0,
    outcome,
    error_message: errorMessage,
    error_kind: errorKind,
    started_at: now,
    finished_at: now,
  });
}
