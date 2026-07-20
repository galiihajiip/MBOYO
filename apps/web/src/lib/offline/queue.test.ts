import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getOfflineDb } from "./db";
import {
  claimPendingItems,
  clearEvidenceAfterConfirmedUpload,
  deleteUnsyncedItem,
  enqueueReport,
  getQueueCounts,
  listQueue,
  markConflict,
  markFailed,
  markSynced,
  pruneSynced,
  retryItem,
} from "./queue";
import { saveDraft, restoreDraft, clearDraft, getLatestUnsubmittedDraft } from "./draft-store";
import { getEvidenceBlob, saveEvidenceBlob } from "./evidence-blobs";
import { createEmptyDraft } from "../reports/types";
import type { ReportDraft } from "../reports/types";

function makeDraft(overrides: Partial<ReportDraft> = {}): ReportDraft {
  const draft = createEmptyDraft(crypto.randomUUID());
  return { ...draft, title: "Rumah roboh sebagian", eventId: "event-1", ...overrides };
}

beforeEach(async () => {
  // Fresh database per test — deleting and letting getOfflineDb() lazily
  // recreate it avoids state leaking between tests via the module-level
  // singleton, without needing a full vitest module-registry reset.
  const db = getOfflineDb();
  await db.delete();
  await db.open();
});

afterEach(() => {
  const db = getOfflineDb();
  db.close();
});

describe("draft-store — persistence", () => {
  it("saves and restores a draft by clientReportId", async () => {
    const draft = makeDraft();
    await saveDraft(draft);

    const restored = await restoreDraft(draft.clientReportId);
    expect(restored?.clientReportId).toBe(draft.clientReportId);
    expect(restored?.title).toBe("Rumah roboh sebagian");
  });

  it("returns null for an unknown clientReportId", async () => {
    const restored = await restoreDraft("does-not-exist");
    expect(restored).toBeNull();
  });

  it("getLatestUnsubmittedDraft returns the most recently saved draft", async () => {
    const first = makeDraft({ clientReportId: crypto.randomUUID(), title: "Pertama" });
    await saveDraft(first);
    await new Promise((r) => setTimeout(r, 5));
    const second = makeDraft({ clientReportId: crypto.randomUUID(), title: "Kedua" });
    await saveDraft(second);

    const latest = await getLatestUnsubmittedDraft();
    expect(latest?.title).toBe("Kedua");
  });

  it("clearDraft removes the draft", async () => {
    const draft = makeDraft();
    await saveDraft(draft);
    await clearDraft(draft.clientReportId);
    expect(await restoreDraft(draft.clientReportId)).toBeNull();
  });

  it("a draft survives a simulated browser restart (db close + reopen)", async () => {
    const draft = makeDraft();
    await saveDraft(draft);

    const db = getOfflineDb();
    db.close();
    await db.open();

    const restored = await restoreDraft(draft.clientReportId);
    expect(restored?.clientReportId).toBe(draft.clientReportId);
  });
});

describe("evidence-blobs — native Blob storage", () => {
  it("stores and retrieves a real Blob instance, not a base64 string", async () => {
    const blob = new Blob(["fake-jpeg-bytes"], { type: "image/jpeg" });
    const id = await saveEvidenceBlob(blob);

    const retrieved = await getEvidenceBlob(id);
    expect(retrieved).toBeInstanceOf(Blob);
    expect(retrieved?.type).toBe("image/jpeg");
    expect(retrieved?.size).toBe(blob.size);

    const text = await retrieved?.text();
    expect(text).toBe("fake-jpeg-bytes");
  });

  it("returns null for a deleted blob", async () => {
    const blob = new Blob(["x"], { type: "image/png" });
    const id = await saveEvidenceBlob(blob);
    const db = getOfflineDb();
    await db.evidenceBlobs.delete(id);
    expect(await getEvidenceBlob(id)).toBeNull();
  });
});

describe("enqueueReport — idempotency / duplicate prevention", () => {
  it("creates exactly one queue row for a given clientReportId even if called twice", async () => {
    const draft = makeDraft();

    const first = await enqueueReport(draft, null);
    const second = await enqueueReport(draft, null);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.item.id).toBe(first.item.id);

    const db = getOfflineDb();
    const rows = await db.reportQueue.where("client_report_id").equals(draft.clientReportId).toArray();
    expect(rows).toHaveLength(1);
  });

  it("two different drafts produce two distinct queue rows", async () => {
    const draftA = makeDraft({ clientReportId: crypto.randomUUID() });
    const draftB = makeDraft({ clientReportId: crypto.randomUUID() });

    await enqueueReport(draftA, null);
    await enqueueReport(draftB, null);

    const counts = await getQueueCounts();
    expect(counts.total).toBe(2);
  });

  it("a new report starts in pending status with zero attempts", async () => {
    const draft = makeDraft();
    const { item } = await enqueueReport(draft, null);
    expect(item.status).toBe("pending");
    expect(item.attempts).toBe(0);
    expect(item.next_retry_at).toBeNull();
  });
});

describe("claimPendingItems — safe claiming", () => {
  it("claims pending items and marks them syncing", async () => {
    const draft = makeDraft();
    await enqueueReport(draft, null);

    const claimed = await claimPendingItems(5);
    expect(claimed).toHaveLength(1);
    expect(claimed[0]?.status).toBe("syncing");

    const counts = await getQueueCounts();
    expect(counts.syncing).toBe(1);
    expect(counts.pending).toBe(0);
  });

  it("never claims the same item twice in a row (already syncing is excluded)", async () => {
    const draft = makeDraft();
    await enqueueReport(draft, null);

    const firstClaim = await claimPendingItems(5);
    const secondClaim = await claimPendingItems(5);

    expect(firstClaim).toHaveLength(1);
    expect(secondClaim).toHaveLength(0);
  });

  it("respects the limit parameter", async () => {
    for (let i = 0; i < 3; i++) {
      await enqueueReport(makeDraft({ clientReportId: crypto.randomUUID() }), null);
    }
    const claimed = await claimPendingItems(2);
    expect(claimed).toHaveLength(2);
  });
});

describe("markFailed / retry — backoff and manual retry", () => {
  it("marks an item failed with an incremented attempt count and a scheduled retry", async () => {
    const draft = makeDraft();
    const { item } = await enqueueReport(draft, null);

    await markFailed(item.id, new Error("network unreachable"));

    const db = getOfflineDb();
    const updated = await db.reportQueue.get(item.id);
    expect(updated?.status).toBe("failed");
    expect(updated?.attempts).toBe(1);
    expect(updated?.last_error).toBe("network unreachable");
    expect(updated?.next_retry_at).not.toBeNull();
  });

  it("does not immediately re-claim a failed item before next_retry_at elapses", async () => {
    const draft = makeDraft();
    const { item } = await enqueueReport(draft, null);
    await claimPendingItems(1);
    await markFailed(item.id, new Error("timeout"));

    // next_retry_at is set to a future time (backoff), so claimPendingItems
    // should not pick it up right away.
    const claimed = await claimPendingItems(5);
    expect(claimed).toHaveLength(0);
  });

  it("retryItem resets status to pending and clears next_retry_at, ignoring backoff", async () => {
    const draft = makeDraft();
    const { item } = await enqueueReport(draft, null);
    await claimPendingItems(1);
    await markFailed(item.id, new Error("timeout"));

    await retryItem(item.id);

    const claimed = await claimPendingItems(5);
    expect(claimed).toHaveLength(1);
    expect(claimed[0]?.id).toBe(item.id);
  });

  it("preserves the failed item's payload and evidence — never discards data on failure", async () => {
    const blob = new Blob(["photo-bytes"], { type: "image/jpeg" });
    const evidenceId = await saveEvidenceBlob(blob);
    const draft = makeDraft();
    const { item } = await enqueueReport(draft, evidenceId);

    await markFailed(item.id, new Error("server 500"));

    const db = getOfflineDb();
    const updated = await db.reportQueue.get(item.id);
    expect(updated?.payload).toBe(JSON.stringify(draft));
    expect(updated?.evidence_blob_id).toBe(evidenceId);
    expect(await getEvidenceBlob(evidenceId)).not.toBeNull();
  });

  it("records a syncAttempts row on failure", async () => {
    const draft = makeDraft();
    const { item } = await enqueueReport(draft, null);
    await markFailed(item.id, new Error("boom"));

    const db = getOfflineDb();
    const attempts = await db.syncAttempts.where("queue_item_id").equals(item.id).toArray();
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.outcome).toBe("failure");
    expect(attempts[0]?.error_message).toBe("boom");
  });
});

describe("markConflict — conflict is distinct from ordinary failure", () => {
  it("sets status to conflict and never schedules an automatic retry", async () => {
    const draft = makeDraft();
    const { item } = await enqueueReport(draft, null);

    await markConflict(item.id, "dedupe_key already resolved to a different report");

    const db = getOfflineDb();
    const updated = await db.reportQueue.get(item.id);
    expect(updated?.status).toBe("conflict");
    expect(updated?.next_retry_at).toBeNull();

    const claimed = await claimPendingItems(5);
    expect(claimed).toHaveLength(0);
  });

  it("a conflicted item can still be resolved via manual retryItem", async () => {
    const draft = makeDraft();
    const { item } = await enqueueReport(draft, null);
    await markConflict(item.id, "conflict");

    await retryItem(item.id);
    const claimed = await claimPendingItems(5);
    expect(claimed).toHaveLength(1);
  });
});

describe("markSynced and cleanup", () => {
  it("marks an item synced with the server_report_id and clears last_error", async () => {
    const draft = makeDraft();
    const { item } = await enqueueReport(draft, null);
    await markFailed(item.id, new Error("first attempt failed"));
    await retryItem(item.id);

    await markSynced(item.id, "server-report-123");

    const db = getOfflineDb();
    const updated = await db.reportQueue.get(item.id);
    expect(updated?.status).toBe("synced");
    expect(updated?.server_report_id).toBe("server-report-123");
    expect(updated?.last_error).toBeNull();
  });

  it("clearEvidenceAfterConfirmedUpload deletes the blob but keeps the queue row", async () => {
    const blob = new Blob(["photo"], { type: "image/jpeg" });
    const evidenceId = await saveEvidenceBlob(blob);
    const draft = makeDraft();
    const { item } = await enqueueReport(draft, evidenceId);
    await markSynced(item.id, "server-report-1");

    await clearEvidenceAfterConfirmedUpload(item.id);

    expect(await getEvidenceBlob(evidenceId)).toBeNull();
    const db = getOfflineDb();
    const stillThere = await db.reportQueue.get(item.id);
    expect(stillThere).not.toBeUndefined();
    expect(stillThere?.evidence_blob_id).toBeNull();
  });

  it("pruneSynced removes only synced items older than the retention window", async () => {
    const oldDraft = makeDraft({ clientReportId: crypto.randomUUID() });
    const recentDraft = makeDraft({ clientReportId: crypto.randomUUID() });

    const { item: oldItem } = await enqueueReport(oldDraft, null);
    const { item: recentItem } = await enqueueReport(recentDraft, null);
    await markSynced(oldItem.id, "server-old");
    await markSynced(recentItem.id, "server-recent");

    // Simulate the old item having synced 25 hours ago (past the 24h retention window).
    const db = getOfflineDb();
    await db.reportQueue.update(oldItem.id, {
      updated_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    });

    const prunedCount = await pruneSynced();
    expect(prunedCount).toBe(1);

    const remaining = await listQueue();
    expect(remaining.map((r) => r.id)).toEqual([recentItem.id]);
  });

  it("pruneSynced also deletes the pruned item's evidence blob", async () => {
    const blob = new Blob(["photo"], { type: "image/jpeg" });
    const evidenceId = await saveEvidenceBlob(blob);
    const draft = makeDraft();
    const { item } = await enqueueReport(draft, evidenceId);
    await markSynced(item.id, "server-1");

    const db = getOfflineDb();
    await db.reportQueue.update(item.id, {
      updated_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    });

    await pruneSynced();
    expect(await getEvidenceBlob(evidenceId)).toBeNull();
  });
});

describe("deleteUnsyncedItem", () => {
  it("deletes a pending/failed item and its evidence blob", async () => {
    const blob = new Blob(["photo"], { type: "image/jpeg" });
    const evidenceId = await saveEvidenceBlob(blob);
    const draft = makeDraft();
    const { item } = await enqueueReport(draft, evidenceId);

    await deleteUnsyncedItem(item.id);

    const db = getOfflineDb();
    expect(await db.reportQueue.get(item.id)).toBeUndefined();
    expect(await getEvidenceBlob(evidenceId)).toBeNull();
  });

  it("refuses to delete an already-synced item", async () => {
    const draft = makeDraft();
    const { item } = await enqueueReport(draft, null);
    await markSynced(item.id, "server-1");

    await deleteUnsyncedItem(item.id);

    const db = getOfflineDb();
    const stillThere = await db.reportQueue.get(item.id);
    expect(stillThere).not.toBeUndefined();
    expect(stillThere?.status).toBe("synced");
  });
});

describe("getQueueCounts / listQueue", () => {
  it("counts items by status accurately across a mixed queue", async () => {
    const a = await enqueueReport(makeDraft({ clientReportId: crypto.randomUUID() }), null);
    const b = await enqueueReport(makeDraft({ clientReportId: crypto.randomUUID() }), null);
    await enqueueReport(makeDraft({ clientReportId: crypto.randomUUID() }), null);

    await markSynced(a.item.id, "server-a");
    await markFailed(b.item.id, new Error("oops"));
    // the third item stays pending

    const counts = await getQueueCounts();
    expect(counts.synced).toBe(1);
    expect(counts.failed).toBe(1);
    expect(counts.pending).toBe(1);
    expect(counts.total).toBe(3);
  });

  it("listQueue supports filtering by status", async () => {
    const a = await enqueueReport(makeDraft({ clientReportId: crypto.randomUUID() }), null);
    await enqueueReport(makeDraft({ clientReportId: crypto.randomUUID() }), null);
    await markSynced(a.item.id, "server-a");

    const syncedOnly = await listQueue(["synced"]);
    expect(syncedOnly).toHaveLength(1);
    expect(syncedOnly[0]?.id).toBe(a.item.id);
  });
});
