import { getOfflineDb } from "./db";

/**
 * Native Blob storage — Dexie stores Blob instances directly via
 * structured clone (no base64 re-encoding, per this block's "native Blob"
 * requirement), which is both smaller on disk and avoids the CPU cost of
 * encoding/decoding a multi-megabyte photo on every read/write.
 */
export async function saveEvidenceBlob(blob: Blob): Promise<string> {
  const db = getOfflineDb();
  const id = crypto.randomUUID();
  await db.evidenceBlobs.add({
    id,
    blob,
    mime_type: blob.type,
    size_bytes: blob.size,
    created_at: new Date().toISOString(),
  });
  return id;
}

export async function getEvidenceBlob(id: string): Promise<Blob | null> {
  const db = getOfflineDb();
  const record = await db.evidenceBlobs.get(id);
  return record?.blob ?? null;
}

export async function deleteEvidenceBlob(id: string): Promise<void> {
  const db = getOfflineDb();
  await db.evidenceBlobs.delete(id);
}
