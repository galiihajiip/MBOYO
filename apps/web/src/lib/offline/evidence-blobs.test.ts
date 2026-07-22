import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getOfflineDb } from "./db";
import { saveEvidenceBlob, getEvidenceBlob, deleteEvidenceBlob } from "./evidence-blobs";

beforeEach(async () => {
  const db = getOfflineDb();
  await db.delete();
  await db.open();
});

afterEach(() => {
  const db = getOfflineDb();
  db.close();
});

describe("saveEvidenceBlob / getEvidenceBlob", () => {
  it("stores and retrieves a real Blob instance, not a base64 string", async () => {
    const blob = new Blob(["fake-jpeg-bytes"], { type: "image/jpeg" });
    const id = await saveEvidenceBlob(blob);

    const retrieved = await getEvidenceBlob(id);
    expect(retrieved).toBeInstanceOf(Blob);
    expect(retrieved?.type).toBe("image/jpeg");
    expect(retrieved?.size).toBe(blob.size);
    expect(await retrieved?.text()).toBe("fake-jpeg-bytes");
  });

  it("returns a distinct id for every call, even for identical blob contents", async () => {
    const blob = new Blob(["same-bytes"], { type: "image/png" });
    const first = await saveEvidenceBlob(blob);
    const second = await saveEvidenceBlob(blob);
    expect(first).not.toBe(second);
  });

  it("persists mime_type and size_bytes derived from the blob itself", async () => {
    const blob = new Blob(["12345"], { type: "image/webp" });
    const id = await saveEvidenceBlob(blob);

    const db = getOfflineDb();
    const record = await db.evidenceBlobs.get(id);
    expect(record?.mime_type).toBe("image/webp");
    expect(record?.size_bytes).toBe(5);
    expect(record?.created_at).toEqual(expect.any(String));
  });

  it("returns null for an id that was never saved", async () => {
    expect(await getEvidenceBlob("never-existed")).toBeNull();
  });

  it("returns null for a blob that has been deleted directly from the table", async () => {
    const blob = new Blob(["x"], { type: "image/png" });
    const id = await saveEvidenceBlob(blob);
    const db = getOfflineDb();
    await db.evidenceBlobs.delete(id);
    expect(await getEvidenceBlob(id)).toBeNull();
  });

  it("round-trips an empty blob without error", async () => {
    const blob = new Blob([], { type: "image/jpeg" });
    const id = await saveEvidenceBlob(blob);
    const retrieved = await getEvidenceBlob(id);
    expect(retrieved?.size).toBe(0);
  });
});

describe("deleteEvidenceBlob", () => {
  it("removes a stored blob so a subsequent get returns null", async () => {
    const blob = new Blob(["photo-bytes"], { type: "image/jpeg" });
    const id = await saveEvidenceBlob(blob);

    await deleteEvidenceBlob(id);

    expect(await getEvidenceBlob(id)).toBeNull();
  });

  it("is a no-op (does not throw) for an id that was never saved", async () => {
    await expect(deleteEvidenceBlob("never-existed")).resolves.toBeUndefined();
  });

  it("only deletes the targeted blob, leaving others intact", async () => {
    const keepBlob = new Blob(["keep"], { type: "image/jpeg" });
    const dropBlob = new Blob(["drop"], { type: "image/jpeg" });
    const keepId = await saveEvidenceBlob(keepBlob);
    const dropId = await saveEvidenceBlob(dropBlob);

    await deleteEvidenceBlob(dropId);

    expect(await getEvidenceBlob(keepId)).not.toBeNull();
    expect(await getEvidenceBlob(dropId)).toBeNull();
  });
});
