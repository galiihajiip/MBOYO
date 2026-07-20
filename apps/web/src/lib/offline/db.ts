import Dexie, { type EntityTable } from "dexie";

/**
 * Durable offline queue for MBOYO report submission, per
 * docs/adr/0005-offline-indexeddb-workbox.md. Five tables:
 *
 * - reportDrafts: the wizard's in-progress ReportDraft (BLOCK 12), keyed by
 *   clientReportId. Lives here so a draft survives reload before the
 *   Reporter has even reached the Submit step.
 * - reportQueue: one row per report the Reporter has submitted — the
 *   actual sync queue, independent of the draft it was built from (the
 *   draft may be cleared once queued; the queue row is authoritative from
 *   that point on).
 * - evidenceBlobs: native Blob storage for report photos, referenced by
 *   reportQueue.evidence_blob_id — kept in a separate table so listing/
 *   scanning the queue never has to load photo bytes into memory.
 * - syncAttempts: an append-only log of every sync attempt (success or
 *   failure) per queue item — the audit trail for "why did this fail
 *   three times," never overwritten, only appended to.
 * - appMetadata: small key/value store for cross-cutting state (e.g. the
 *   single-flight sync lock, storage-estimate cache) that doesn't belong
 *   to any one report.
 */

export type QueueStatus = "pending" | "syncing" | "failed" | "synced" | "conflict";

export interface ReportQueueItem {
  id: string;
  /** Unique — the idempotency key. See ADR 0005 / docs/architecture/SEQUENCE_FLOWS.md Diagram 3. */
  client_report_id: string;
  event_id: string | null;
  /** The full ReportDraft payload, serialized — everything the server upload needs except the photo bytes. */
  payload: string;
  evidence_blob_id: string | null;
  status: QueueStatus;
  attempts: number;
  last_error: string | null;
  /** Null until a failure schedules a retry; exponential backoff + jitter (see ./backoff.ts). */
  next_retry_at: string | null;
  created_at: string;
  updated_at: string;
  /** Populated once the server confirms creation — the reports.id this queue item became. */
  server_report_id: string | null;
  /**
   * True once this item's location (if any) has been confirmed recorded
   * server-side (BLOCK 17) — mirrors evidence_blob_id's clear-after-confirm
   * pattern, so a retried sync pass (report already synced, only the
   * location leg previously failed) doesn't record duplicate
   * geolocation_observation rows for the same draft on every retry.
   * Reports with no captured location (draft.location is null) are treated
   * as vacuously synced and never attempt this leg.
   */
  location_synced: boolean;
}

export interface EvidenceBlobRecord {
  id: string;
  blob: Blob;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface SyncAttemptRecord {
  id: string;
  queue_item_id: string;
  attempt_number: number;
  outcome: "success" | "failure";
  /** Present on failure — see ./errors.ts for the permanent/retryable classification this reflects. */
  error_message: string | null;
  error_kind: "retryable" | "permanent" | null;
  started_at: string;
  finished_at: string;
}

export interface AppMetadataRecord {
  key: string;
  value: string;
  updated_at: string;
}

export interface ReportDraftRecord {
  client_report_id: string;
  /** The ReportDraft (BLOCK 12 shape), serialized — see ./draft-store.ts for the (de)serialization boundary. */
  data: string;
  updated_at: string;
}

class MboyoOfflineDatabase extends Dexie {
  reportDrafts!: EntityTable<ReportDraftRecord, "client_report_id">;
  reportQueue!: EntityTable<ReportQueueItem, "id">;
  evidenceBlobs!: EntityTable<EvidenceBlobRecord, "id">;
  syncAttempts!: EntityTable<SyncAttemptRecord, "id">;
  appMetadata!: EntityTable<AppMetadataRecord, "key">;

  constructor() {
    super("mboyo-offline");

    this.version(1).stores({
      reportDrafts: "client_report_id, updated_at",
      // client_report_id is declared unique (&) — this is the idempotency
      // guarantee at the schema level: Dexie/IndexedDB itself rejects a
      // second row with the same key, not just application-level checking.
      reportQueue: "id, &client_report_id, status, next_retry_at, event_id, updated_at",
      evidenceBlobs: "id",
      syncAttempts: "id, queue_item_id, started_at",
      appMetadata: "key",
    });
  }
}

/**
 * Lazily constructed singleton — IndexedDB (and therefore Dexie) does not
 * exist during Next.js's server-side rendering/build, so this must never
 * be evaluated at module import time in a context that could run on the
 * server. Call sites are all client components/hooks (see
 * lib/offline/dexie-report-repository.ts), consistent with the rest of
 * this codebase's lazy-env pattern (packages/domain/src/env.ts).
 */
let instance: MboyoOfflineDatabase | null = null;

export function getOfflineDb(): MboyoOfflineDatabase {
  instance ??= new MboyoOfflineDatabase();
  return instance;
}
