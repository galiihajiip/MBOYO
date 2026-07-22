import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getOfflineDb } from "./db";

beforeEach(async () => {
  // Fresh database per test — same isolation strategy as queue.test.ts:
  // delete then reopen via the lazy singleton so no state leaks across
  // tests through the module-level `instance`.
  const db = getOfflineDb();
  await db.delete();
  await db.open();
});

afterEach(() => {
  const db = getOfflineDb();
  db.close();
});

describe("getOfflineDb — schema", () => {
  it("opens successfully against the real (fake-indexeddb) IndexedDB", () => {
    const db = getOfflineDb();
    expect(db.isOpen()).toBe(true);
    expect(db.name).toBe("mboyo-offline");
  });

  it("returns the same singleton instance across calls", () => {
    expect(getOfflineDb()).toBe(getOfflineDb());
  });

  it("declares exactly the five expected tables", () => {
    const db = getOfflineDb();
    const tableNames = db.tables.map((t) => t.name).sort();
    expect(tableNames).toEqual(
      ["appMetadata", "evidenceBlobs", "reportDrafts", "reportQueue", "syncAttempts"].sort(),
    );
  });

  it("reportDrafts is keyed by client_report_id and indexes updated_at", () => {
    const db = getOfflineDb();
    const schema = db.reportDrafts.schema;
    expect(schema.primKey.keyPath).toBe("client_report_id");
    expect(schema.indexes.map((i) => i.name)).toContain("updated_at");
  });

  it("reportQueue is keyed by id with a unique index on client_report_id and secondary indexes for sync scanning", () => {
    const db = getOfflineDb();
    const schema = db.reportQueue.schema;
    expect(schema.primKey.keyPath).toBe("id");

    const indexNames = schema.indexes.map((i) => i.name);
    expect(indexNames).toEqual(
      expect.arrayContaining(["client_report_id", "status", "next_retry_at", "event_id", "updated_at"]),
    );

    const clientReportIdIndex = schema.indexes.find((i) => i.name === "client_report_id");
    expect(clientReportIdIndex?.unique).toBe(true);
  });

  it("evidenceBlobs is keyed by id with no secondary indexes", () => {
    const db = getOfflineDb();
    const schema = db.evidenceBlobs.schema;
    expect(schema.primKey.keyPath).toBe("id");
    expect(schema.indexes).toHaveLength(0);
  });

  it("syncAttempts is keyed by id and indexes queue_item_id and started_at", () => {
    const db = getOfflineDb();
    const schema = db.syncAttempts.schema;
    expect(schema.primKey.keyPath).toBe("id");
    expect(schema.indexes.map((i) => i.name)).toEqual(
      expect.arrayContaining(["queue_item_id", "started_at"]),
    );
  });

  it("appMetadata is keyed by key with no secondary indexes", () => {
    const db = getOfflineDb();
    const schema = db.appMetadata.schema;
    expect(schema.primKey.keyPath).toBe("key");
    expect(schema.indexes).toHaveLength(0);
  });

  it("supports basic put/get roundtrips on every table", async () => {
    const db = getOfflineDb();
    const now = new Date().toISOString();

    await db.reportDrafts.put({ client_report_id: "draft-1", data: "{}", updated_at: now });
    expect(await db.reportDrafts.get("draft-1")).toMatchObject({ client_report_id: "draft-1" });

    await db.reportQueue.put({
      id: "q-1",
      client_report_id: "draft-1",
      event_id: null,
      payload: "{}",
      evidence_blob_id: null,
      status: "pending",
      attempts: 0,
      last_error: null,
      next_retry_at: null,
      created_at: now,
      updated_at: now,
      server_report_id: null,
      location_synced: true,
    });
    expect(await db.reportQueue.get("q-1")).toMatchObject({ id: "q-1", status: "pending" });

    await db.evidenceBlobs.put({
      id: "blob-1",
      blob: new Blob(["x"]),
      mime_type: "image/jpeg",
      size_bytes: 1,
      created_at: now,
    });
    expect(await db.evidenceBlobs.get("blob-1")).toMatchObject({ id: "blob-1" });

    await db.syncAttempts.put({
      id: "attempt-1",
      queue_item_id: "q-1",
      attempt_number: 1,
      outcome: "success",
      error_message: null,
      error_kind: null,
      started_at: now,
      finished_at: now,
    });
    expect(await db.syncAttempts.get("attempt-1")).toMatchObject({ id: "attempt-1" });

    await db.appMetadata.put({ key: "foo", value: "bar", updated_at: now });
    expect(await db.appMetadata.get("foo")).toMatchObject({ key: "foo", value: "bar" });
  });

  it("enforces the unique constraint on reportQueue.client_report_id", async () => {
    const db = getOfflineDb();
    const now = new Date().toISOString();
    const base = {
      event_id: null,
      payload: "{}",
      evidence_blob_id: null,
      status: "pending" as const,
      attempts: 0,
      last_error: null,
      next_retry_at: null,
      created_at: now,
      updated_at: now,
      server_report_id: null,
      location_synced: true,
    };

    await db.reportQueue.add({ id: "q-a", client_report_id: "dup-key", ...base });
    await expect(db.reportQueue.add({ id: "q-b", client_report_id: "dup-key", ...base })).rejects.toThrow();
  });
});
