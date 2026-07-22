import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getOfflineDb } from "./db";
import { DexieReportRepository } from "./dexie-report-repository";
import { getEvidenceBlob } from "./evidence-blobs";
import { createEmptyDraft } from "../reports/types";
import type { ReportDraft } from "../reports/types";
import type { QueueStatus } from "./db";

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

  // The repository's constructor calls requestPersistentStorage(), and
  // submitDraft calls triggerBackgroundSync() — both read `navigator`.
  // Stubbing a minimal-but-complete navigator here keeps every test's
  // real focus (queue/draft/evidence composition) free of unrelated
  // "navigator.storage is undefined" noise.
  vi.stubGlobal("navigator", {
    storage: {
      persist: vi.fn().mockResolvedValue(true),
    },
    serviceWorker: {
      ready: Promise.resolve({
        sync: { register: vi.fn().mockResolvedValue(undefined) },
        active: { postMessage: vi.fn() },
      }),
    },
  });
});

afterEach(() => {
  const db = getOfflineDb();
  db.close();
  vi.unstubAllGlobals();
});

describe("DexieReportRepository — construction", () => {
  it("requests persistent storage on construction (best-effort, does not throw if denied/unsupported)", () => {
    vi.stubGlobal("navigator", { storage: { persist: vi.fn().mockResolvedValue(false) } });
    expect(() => new DexieReportRepository()).not.toThrow();
  });

  it("does not throw even when navigator.storage is entirely unavailable", () => {
    vi.stubGlobal("navigator", {});
    expect(() => new DexieReportRepository()).not.toThrow();
  });
});

describe("DexieReportRepository — draft methods", () => {
  it("saveDraft / getDraft round-trip a draft", async () => {
    const repo = new DexieReportRepository();
    const draft = makeDraft();

    await repo.saveDraft(draft);
    const restored = await repo.getDraft(draft.clientReportId);

    expect(restored?.clientReportId).toBe(draft.clientReportId);
    expect(restored?.title).toBe(draft.title);
  });

  it("getDraft returns null for an unknown clientReportId", async () => {
    const repo = new DexieReportRepository();
    expect(await repo.getDraft("unknown")).toBeNull();
  });

  it("getLatestUnsubmittedDraft delegates to draft-store's most-recently-updated draft", async () => {
    const repo = new DexieReportRepository();
    const first = makeDraft({ clientReportId: crypto.randomUUID(), title: "Pertama" });
    await repo.saveDraft(first);
    await new Promise((r) => setTimeout(r, 5));
    const second = makeDraft({ clientReportId: crypto.randomUUID(), title: "Kedua" });
    await repo.saveDraft(second);

    const latest = await repo.getLatestUnsubmittedDraft();
    expect(latest?.title).toBe("Kedua");
  });

  it("deleteDraft removes the draft (delegates to clearDraft)", async () => {
    const repo = new DexieReportRepository();
    const draft = makeDraft();
    await repo.saveDraft(draft);

    await repo.deleteDraft(draft.clientReportId);

    expect(await repo.getDraft(draft.clientReportId)).toBeNull();
  });
});

describe("DexieReportRepository — submitDraft", () => {
  it("enqueues the draft, clears the in-progress draft, and reports ok:true", async () => {
    const repo = new DexieReportRepository();
    const draft = makeDraft();
    await repo.saveDraft(draft);

    const result = await repo.submitDraft(draft);

    expect(result).toEqual({ ok: true });
    expect(await repo.getDraft(draft.clientReportId)).toBeNull();

    const owned = await repo.getOwnReport(draft.clientReportId);
    expect(owned?.status).toBe("queued_offline");
  });

  it("moves the photo blob into evidenceBlobs storage and links it on the queue row", async () => {
    const repo = new DexieReportRepository();
    const draft = makeDraftWithPhoto();

    await repo.submitDraft(draft);

    const db = getOfflineDb();
    const [row] = await db.reportQueue.where("client_report_id").equals(draft.clientReportId).toArray();
    expect(row?.evidence_blob_id).toEqual(expect.any(String));

    const blob = await getEvidenceBlob(row!.evidence_blob_id!);
    expect(blob).toBeInstanceOf(Blob);
    expect(await blob?.text()).toBe("fake-jpeg-bytes");
  });

  it("does not create an evidence blob when the draft has no photo", async () => {
    const repo = new DexieReportRepository();
    const draft = makeDraft();

    await repo.submitDraft(draft);

    const db = getOfflineDb();
    const [row] = await db.reportQueue.where("client_report_id").equals(draft.clientReportId).toArray();
    expect(row?.evidence_blob_id).toBeNull();
  });

  it("is idempotent: submitting the same clientReportId twice creates only one queue row", async () => {
    const repo = new DexieReportRepository();
    const draft = makeDraft();

    const first = await repo.submitDraft(draft);
    const second = await repo.submitDraft(draft);

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });

    const db = getOfflineDb();
    const rows = await db.reportQueue.where("client_report_id").equals(draft.clientReportId).toArray();
    expect(rows).toHaveLength(1);
  });

  it("triggers a background sync request after a successful submit", async () => {
    const syncRegister = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      storage: { persist: vi.fn().mockResolvedValue(true) },
      serviceWorker: {
        ready: Promise.resolve({
          sync: { register: syncRegister },
          active: { postMessage: vi.fn() },
        }),
      },
    });

    const repo = new DexieReportRepository();
    await repo.submitDraft(makeDraft());

    // triggerBackgroundSync is fire-and-forget (`void`) inside submitDraft,
    // so flush microtasks before asserting.
    await new Promise((r) => setTimeout(r, 0));
    expect(syncRegister).toHaveBeenCalledWith("mboyo-report-queue-replay");
  });

  it("returns ok:false with a human-readable error message when enqueueing fails", async () => {
    const repo = new DexieReportRepository();
    const draft = makeDraft();

    const db = getOfflineDb();
    db.close();

    const result = await repo.submitDraft(draft);

    expect(result.ok).toBe(false);
    expect(result.error).toEqual(expect.any(String));
    expect(result.error!.length).toBeGreaterThan(0);

    await db.open();
  });
});

describe("DexieReportRepository — listOwnReports / getOwnReport", () => {
  it("lists submitted reports mapped from queue status to ReportListItem status", async () => {
    const repo = new DexieReportRepository();
    const draft = makeDraft({ title: "Longsor di Jalan Merdeka" });
    await repo.submitDraft(draft);

    const items = await repo.listOwnReports();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      clientReportId: draft.clientReportId,
      title: "Longsor di Jalan Merdeka",
      status: "queued_offline",
      observedSeverity: draft.observedSeverity,
    });
  });

  it("maps every QueueStatus to the expected ReportListItem status", async () => {
    const repo = new DexieReportRepository();
    const db = getOfflineDb();

    const statuses: Array<[QueueStatus, string]> = [
      ["pending", "queued_offline"],
      ["syncing", "syncing"],
      ["synced", "submitted"],
      ["failed", "failed"],
      ["conflict", "failed"],
    ];

    for (const [status, expected] of statuses) {
      const draft = makeDraft({ clientReportId: crypto.randomUUID() });
      await repo.submitDraft(draft);
      await db.reportQueue.where("client_report_id").equals(draft.clientReportId).modify({ status });

      const item = await repo.getOwnReport(draft.clientReportId);
      expect(item?.status).toBe(expected);
    }
  });

  it("falls back to a placeholder title when the draft's title is empty", async () => {
    const repo = new DexieReportRepository();
    const draft = makeDraft({ title: "" });
    await repo.submitDraft(draft);

    const items = await repo.listOwnReports();
    expect(items[0]?.title).toBe("Laporan tanpa judul");
  });

  it("orders reports most-recently-updated first", async () => {
    const repo = new DexieReportRepository();
    const first = makeDraft({ clientReportId: crypto.randomUUID(), title: "Pertama" });
    await repo.submitDraft(first);
    await new Promise((r) => setTimeout(r, 5));
    const second = makeDraft({ clientReportId: crypto.randomUUID(), title: "Kedua" });
    await repo.submitDraft(second);

    const items = await repo.listOwnReports();
    expect(items.map((i) => i.title)).toEqual(["Kedua", "Pertama"]);
  });

  it("getOwnReport returns null for a clientReportId that was never submitted", async () => {
    const repo = new DexieReportRepository();
    expect(await repo.getOwnReport("never-submitted")).toBeNull();
  });

  it("getOwnReport finds a specific report among several queued reports", async () => {
    const repo = new DexieReportRepository();
    const target = makeDraft({ clientReportId: crypto.randomUUID(), title: "Target" });
    await repo.submitDraft(target);
    await repo.submitDraft(makeDraft({ clientReportId: crypto.randomUUID(), title: "Lainnya" }));

    const found = await repo.getOwnReport(target.clientReportId);
    expect(found?.title).toBe("Target");
  });
});

describe("dexieReportRepository — module singleton export", () => {
  it("exports a ready-to-use DexieReportRepository instance", async () => {
    const mod = await import("./dexie-report-repository");
    expect(mod.dexieReportRepository).toBeInstanceOf(mod.DexieReportRepository);
  });
});
