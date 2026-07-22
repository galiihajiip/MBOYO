import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getOfflineDb } from "./db";
import { saveDraft, restoreDraft, getLatestUnsubmittedDraft, clearDraft } from "./draft-store";
import { createEmptyDraft } from "../reports/types";
import type { ReportDraft } from "../reports/types";

function makeDraft(overrides: Partial<ReportDraft> = {}): ReportDraft {
  const draft = createEmptyDraft(crypto.randomUUID());
  return { ...draft, title: "Rumah roboh sebagian", eventId: "event-1", ...overrides };
}

function makeDraftWithPhoto(overrides: Partial<ReportDraft> = {}): ReportDraft {
  return makeDraft({
    photo: {
      previewUrl: "blob:http://localhost/preview-1",
      blob: new Blob(["fake-jpeg-bytes"], { type: "image/jpeg" }),
      mimeType: "image/jpeg",
      sizeBytes: 15,
      qualityWarning: null,
    },
    ...overrides,
  });
}

beforeEach(async () => {
  const db = getOfflineDb();
  await db.delete();
  await db.open();
});

afterEach(() => {
  const db = getOfflineDb();
  db.close();
});

describe("saveDraft / restoreDraft", () => {
  it("round-trips a plain (photo-less) draft's fields", async () => {
    const draft = makeDraft();
    await saveDraft(draft);

    const restored = await restoreDraft(draft.clientReportId);
    expect(restored).toEqual({ ...draft, photo: null });
  });

  it("overwrites an existing draft for the same clientReportId (put semantics, not add)", async () => {
    const draft = makeDraft({ title: "Judul awal" });
    await saveDraft(draft);

    await saveDraft({ ...draft, title: "Judul revisi" });

    const restored = await restoreDraft(draft.clientReportId);
    expect(restored?.title).toBe("Judul revisi");

    const db = getOfflineDb();
    const rows = await db.reportDrafts.toArray();
    expect(rows).toHaveLength(1);
  });

  it("returns null for an unknown clientReportId", async () => {
    expect(await restoreDraft("does-not-exist")).toBeNull();
  });

  it("persists the underlying row as JSON-serialized data with an updated_at timestamp", async () => {
    const draft = makeDraft();
    await saveDraft(draft);

    const db = getOfflineDb();
    const row = await db.reportDrafts.get(draft.clientReportId);
    expect(row).toBeDefined();
    expect(typeof row?.data).toBe("string");
    expect(() => JSON.parse(row!.data) as unknown).not.toThrow();
    expect(row?.updated_at).toEqual(expect.any(String));
  });
});

describe("saveDraft / restoreDraft — photo handling", () => {
  it("never persists the live Blob or previewUrl — restored photo is null even though a photo was saved", async () => {
    const draft = makeDraftWithPhoto();
    await saveDraft(draft);

    const restored = await restoreDraft(draft.clientReportId);
    expect(restored?.photo).toBeNull();
  });

  it("does not throw serializing a draft with a photo (Blob is stripped before JSON.stringify)", async () => {
    const draft = makeDraftWithPhoto();
    await expect(saveDraft(draft)).resolves.toBeUndefined();
  });
});

describe("getLatestUnsubmittedDraft", () => {
  it("returns null when there are no drafts", async () => {
    expect(await getLatestUnsubmittedDraft()).toBeNull();
  });

  it("returns the most recently saved draft, ordered by updated_at", async () => {
    const first = makeDraft({ clientReportId: crypto.randomUUID(), title: "Pertama" });
    await saveDraft(first);
    await new Promise((r) => setTimeout(r, 5));
    const second = makeDraft({ clientReportId: crypto.randomUUID(), title: "Kedua" });
    await saveDraft(second);

    const latest = await getLatestUnsubmittedDraft();
    expect(latest?.clientReportId).toBe(second.clientReportId);
    expect(latest?.title).toBe("Kedua");
  });

  it("reflects re-saving an older draft as the new latest", async () => {
    const first = makeDraft({ clientReportId: crypto.randomUUID(), title: "Pertama" });
    await saveDraft(first);
    await new Promise((r) => setTimeout(r, 5));
    const second = makeDraft({ clientReportId: crypto.randomUUID(), title: "Kedua" });
    await saveDraft(second);
    await new Promise((r) => setTimeout(r, 5));

    await saveDraft({ ...first, title: "Pertama diperbarui" });

    const latest = await getLatestUnsubmittedDraft();
    expect(latest?.clientReportId).toBe(first.clientReportId);
    expect(latest?.title).toBe("Pertama diperbarui");
  });
});

describe("clearDraft", () => {
  it("removes the draft so restoreDraft subsequently returns null", async () => {
    const draft = makeDraft();
    await saveDraft(draft);

    await clearDraft(draft.clientReportId);

    expect(await restoreDraft(draft.clientReportId)).toBeNull();
  });

  it("is a no-op (does not throw) for a clientReportId that was never saved", async () => {
    await expect(clearDraft("never-existed")).resolves.toBeUndefined();
  });

  it("only removes the targeted draft, leaving others intact", async () => {
    const keep = makeDraft({ clientReportId: crypto.randomUUID() });
    const drop = makeDraft({ clientReportId: crypto.randomUUID() });
    await saveDraft(keep);
    await saveDraft(drop);

    await clearDraft(drop.clientReportId);

    expect(await restoreDraft(keep.clientReportId)).not.toBeNull();
    expect(await restoreDraft(drop.clientReportId)).toBeNull();
  });
});

describe("draft persistence across a simulated reload", () => {
  it("a draft survives a db close + reopen", async () => {
    const draft = makeDraft();
    await saveDraft(draft);

    const db = getOfflineDb();
    db.close();
    await db.open();

    const restored = await restoreDraft(draft.clientReportId);
    expect(restored?.clientReportId).toBe(draft.clientReportId);
    expect(restored?.title).toBe(draft.title);
  });
});
