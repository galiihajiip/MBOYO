import { getOfflineDb } from "./db";
import type { ReportDraft } from "../reports/types";

/**
 * Draft persistence — the reportDrafts table. Distinct from the queue
 * (./queue.ts): a draft is pre-submission, in-progress wizard state; once
 * the Reporter submits, enqueueReport() creates a reportQueue row and the
 * draft can be cleared. Serialized to JSON on write; the photo Blob itself
 * is NOT embedded in this JSON (see note on ReportPhoto below) — it lives
 * in evidenceBlobs once the draft reaches enqueue, keeping this table's
 * rows small and fast to scan for restore-on-mount.
 *
 * While still a draft (pre-enqueue), the in-progress Blob is kept as-is in
 * the serialized payload's structuredClone-compatible form — Dexie itself
 * supports storing Blob instances directly via structured clone, so no
 * base64 encoding step is needed; "serialized to JSON" above refers to the
 * non-Blob fields being plain JSON-safe values, while the Blob rides
 * alongside via Dexie's native structured-clone storage.
 */

export async function saveDraft(draft: ReportDraft): Promise<void> {
  const db = getOfflineDb();
  await db.reportDrafts.put({
    client_report_id: draft.clientReportId,
    data: JSON.stringify(serializeDraft(draft)),
    updated_at: new Date().toISOString(),
  });
}

export async function restoreDraft(clientReportId: string): Promise<ReportDraft | null> {
  const db = getOfflineDb();
  const record = await db.reportDrafts.get(clientReportId);
  if (!record) return null;
  return deserializeDraft(JSON.parse(record.data) as SerializedDraft);
}

export async function getLatestUnsubmittedDraft(): Promise<ReportDraft | null> {
  const db = getOfflineDb();
  const records = await db.reportDrafts.orderBy("updated_at").reverse().toArray();
  const first = records[0];
  if (!first) return null;
  return deserializeDraft(JSON.parse(first.data) as SerializedDraft);
}

export async function clearDraft(clientReportId: string): Promise<void> {
  const db = getOfflineDb();
  await db.reportDrafts.delete(clientReportId);
}

/**
 * ReportDraft minus the live Blob/previewUrl (an object URL is
 * page-session-specific and must never be persisted — it would dangle
 * after reload) — the Blob's bytes are handled separately once a draft is
 * enqueued (see ./queue.ts enqueueReport), and the draft-only phase simply
 * does not persist a photo across reload. This mirrors real offline-first
 * apps: the photo is re-attached from the wizard's live in-memory state up
 * until enqueue, at which point it moves into durable evidenceBlobs storage.
 */
type SerializedDraft = Omit<ReportDraft, "photo"> & {
  photo: Omit<ReportDraft["photo"], "blob" | "previewUrl"> | null;
};

function serializeDraft(draft: ReportDraft): SerializedDraft {
  if (!draft.photo) return { ...draft, photo: null };
  const { blob: _blob, previewUrl: _previewUrl, ...photoMeta } = draft.photo;
  return { ...draft, photo: photoMeta };
}

function deserializeDraft(serialized: SerializedDraft): ReportDraft {
  // photo.blob/previewUrl are intentionally absent post-reload — the
  // wizard step components treat a metadata-only photo (quality warning
  // known, but no blob) as "re-take needed," never silently fabricating a
  // blob that doesn't exist.
  return { ...serialized, photo: null };
}
