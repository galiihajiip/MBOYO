import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getOfflineDb } from "./db";
import { enqueueReport, listQueue } from "./queue";
import { saveEvidenceBlob } from "./evidence-blobs";
import { createEmptyDraft } from "../reports/types";
import type { ReportDraft } from "../reports/types";
import { runQueueReplay } from "./sync-replay";

function makeDraft(overrides: Partial<ReportDraft> = {}): ReportDraft {
  const draft = createEmptyDraft(crypto.randomUUID());
  return { ...draft, title: "Rumah roboh sebagian", eventId: "event-1", ...overrides };
}

beforeEach(async () => {
  const db = getOfflineDb();
  await db.delete();
  await db.open();
});

afterEach(() => {
  const db = getOfflineDb();
  db.close();
  vi.restoreAllMocks();
});

/**
 * runQueueReplay is the single implementation every trigger (native
 * Background Sync, browser-online fallback, SW startup, message-request)
 * calls into — these tests exercise that shared function directly with a
 * mocked fetch, which is exactly what every trigger's real-world behavior
 * reduces to. There is no separate "with Background Sync" vs "without"
 * code path to test, by construction — proving this one function is
 * correct proves parity across all trigger sources.
 */
describe("runQueueReplay", () => {
  it("does nothing and reports ranAtAll:false-equivalent zero counts when the queue is empty", async () => {
    const fetchImpl = vi.fn();
    const summary = await runQueueReplay({ fetchImpl });

    expect(summary.claimed).toBe(0);
    expect(summary.succeeded).toBe(0);
    expect(summary.failed).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("syncs a pending item successfully and marks it synced with the server report id", async () => {
    const draft = makeDraft();
    await enqueueReport(draft, null);

    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true, data: { report: { id: "server-1" } }, requestId: "req-1" }), {
          status: 200,
        }),
      ),
    );

    const summary = await runQueueReplay({ fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(summary.claimed).toBe(1);
    expect(summary.succeeded).toBe(1);
    expect(summary.failed).toBe(0);
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/reports",
      expect.objectContaining({ method: "POST" }),
    );

    const [item] = await listQueue(["synced"]);
    expect(item?.server_report_id).toBe("server-1");
  });

  it("uploads queued evidence after a successful report sync", async () => {
    const blob = new Blob(["photo-bytes"], { type: "image/jpeg" });
    const evidenceId = await saveEvidenceBlob(blob);
    const draft = makeDraft();
    await enqueueReport(draft, evidenceId);

    const calls: string[] = [];
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      calls.push(url);
      if (url === "/api/reports") {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, data: { report: { id: "server-2" } }, requestId: "req-2" }), {
            status: 200,
          }),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });

    const summary = await runQueueReplay({ fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(summary.succeeded).toBe(1);
    expect(calls).toEqual(["/api/reports", "/api/reports/evidence"]);

    const [item] = await listQueue(["synced"]);
    expect(item?.evidence_blob_id).toBeNull();
  });

  it("uploads a captured location after a successful report sync, longitude before latitude", async () => {
    const draft = makeDraft({
      location: {
        latitude: -6.175,
        longitude: 106.827,
        accuracyMeters: 12,
        altitudeMeters: null,
        headingDegrees: null,
        capturedAtClient: "2026-07-17T00:00:00.000Z",
        source: "gps",
        manualAddress: null,
      },
    });
    await enqueueReport(draft, null);

    const calls: Array<{ url: string; body: unknown }> = [];
    const fetchImpl = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      calls.push({ url, body: init?.body ? JSON.parse(init.body as string) : null });
      if (url === "/api/reports") {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, data: { report: { id: "server-loc-1" } }, requestId: "req-1" }), {
            status: 200,
          }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, data: { observation: { id: "obs-1" } }, requestId: "req-2" }), {
          status: 201,
        }),
      );
    });

    const summary = await runQueueReplay({ fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(summary.succeeded).toBe(1);
    const locationCall = calls.find((c) => c.url === "/api/reports/server-loc-1/location");
    expect(locationCall).toBeDefined();
    expect(locationCall?.body).toMatchObject({ longitude: 106.827, latitude: -6.175, source: "gps" });

    const [item] = await listQueue(["synced"]);
    expect(item?.location_synced).toBe(true);
  });

  it("does not attempt a location upload when the draft has no captured location", async () => {
    const draft = makeDraft();
    await enqueueReport(draft, null);

    const calls: string[] = [];
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      calls.push(url);
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, data: { report: { id: "server-noloc" } }, requestId: "req-1" }), {
          status: 200,
        }),
      );
    });

    await runQueueReplay({ fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(calls).toEqual(["/api/reports"]);
    const [item] = await listQueue(["synced"]);
    expect(item?.location_synced).toBe(true);
  });

  it("marks location upload failure as retryable by default (e.g. a transient internal_error)", async () => {
    const draft = makeDraft({
      location: {
        latitude: -6.175,
        longitude: 106.827,
        accuracyMeters: null,
        altitudeMeters: null,
        headingDegrees: null,
        capturedAtClient: "2026-07-17T00:00:00.000Z",
        source: "manual_pin",
        manualAddress: null,
      },
    });
    await enqueueReport(draft, null);

    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url === "/api/reports") {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, data: { report: { id: "server-loc-2" } }, requestId: "req-1" }), {
            status: 200,
          }),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ ok: false, error: { code: "internal_error", message: "Gagal menyimpan lokasi." }, requestId: "req-2" }),
          { status: 500 },
        ),
      );
    });

    const summary = await runQueueReplay({ fetchImpl: fetchImpl as unknown as typeof fetch });

    // The report itself synced; only the location leg failed and is
    // retryable, so the item as a whole is reported failed (not
    // succeeded), and location_synced must stay false so the next replay
    // pass retries this leg.
    expect(summary.failed).toBe(1);
    const [item] = await listQueue(["failed"]);
    expect(item?.location_synced).toBe(false);
    expect(item?.server_report_id).toBe("server-loc-2");
    expect(item?.last_error).toBe("Gagal menyimpan lokasi.");
  });

  it("marks location upload failure as a conflict (no auto-retry) when the endpoint reports validation_failed", async () => {
    const draft = makeDraft({
      location: {
        latitude: 999,
        longitude: 106.827,
        accuracyMeters: null,
        altitudeMeters: null,
        headingDegrees: null,
        capturedAtClient: "2026-07-17T00:00:00.000Z",
        source: "manual_pin",
        manualAddress: null,
      },
    });
    await enqueueReport(draft, null);

    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url === "/api/reports") {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, data: { report: { id: "server-loc-3" } }, requestId: "req-1" }), {
            status: 200,
          }),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ok: false,
            error: { code: "validation_failed", message: "Koordinat lokasi tidak valid." },
            requestId: "req-2",
          }),
          { status: 400 },
        ),
      );
    });

    const summary = await runQueueReplay({ fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(summary.failed).toBe(1);
    const [item] = await listQueue(["conflict"]);
    expect(item?.location_synced).toBe(false);
    expect(item?.next_retry_at).toBeNull();
  });

  it("marks evidence upload failure as retryable when the endpoint doesn't classify it as permanent (e.g. a transient storage_upload_failed)", async () => {
    const blob = new Blob(["photo-bytes"], { type: "image/jpeg" });
    const evidenceId = await saveEvidenceBlob(blob);
    const draft = makeDraft();
    await enqueueReport(draft, evidenceId);

    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url === "/api/reports") {
        return Promise.resolve(
          new Response(
            JSON.stringify({ ok: true, data: { report: { id: "server-evidence-1" } }, requestId: "req-3" }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ ok: false, code: "storage_upload_failed", error: "Gagal menyimpan foto.", permanent: false }),
          { status: 500 },
        ),
      );
    });

    const summary = await runQueueReplay({ fetchImpl: fetchImpl as unknown as typeof fetch });

    // The report itself synced successfully (markSynced ran); only the
    // evidence leg failed and is retryable — the item as a whole is
    // reported failed (not succeeded) since its evidence didn't upload yet.
    expect(summary.failed).toBe(1);
    const [item] = await listQueue(["failed"]);
    expect(item?.last_error).toBe("Gagal menyimpan foto.");
    expect(item?.server_report_id).toBe("server-evidence-1");
  });

  it("marks evidence upload failure as a conflict (no auto-retry) when the endpoint classifies it as permanent (e.g. decode_failed)", async () => {
    const blob = new Blob(["corrupt-bytes"], { type: "image/jpeg" });
    const evidenceId = await saveEvidenceBlob(blob);
    const draft = makeDraft();
    await enqueueReport(draft, evidenceId);

    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url === "/api/reports") {
        return Promise.resolve(
          new Response(
            JSON.stringify({ ok: true, data: { report: { id: "server-evidence-2" } }, requestId: "req-4" }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({ ok: false, code: "decode_failed", error: "Berkas foto rusak.", permanent: true }),
          { status: 422 },
        ),
      );
    });

    const summary = await runQueueReplay({ fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(summary.failed).toBe(1);
    const [item] = await listQueue(["conflict"]);
    expect(item?.last_error).toBe("Berkas foto rusak.");
    expect(item?.next_retry_at).toBeNull();
  });

  it("marks a retryable failure (e.g. server 500) as failed, not conflict, so it can be auto-retried later", async () => {
    const draft = makeDraft();
    await enqueueReport(draft, null);

    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            ok: false,
            error: { code: "internal_error", message: "Kesalahan server." },
            requestId: "req-err-1",
          }),
          { status: 500 },
        ),
      ),
    );

    const summary = await runQueueReplay({ fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(summary.failed).toBe(1);
    const [item] = await listQueue(["failed"]);
    expect(item?.last_error).toBe("Kesalahan server.");
  });

  it("marks a permanent failure (e.g. 400 validation) as conflict, with no automatic retry scheduled", async () => {
    const draft = makeDraft();
    await enqueueReport(draft, null);

    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            ok: false,
            error: { code: "validation_failed", message: "Data laporan tidak valid." },
            requestId: "req-err-2",
          }),
          { status: 400 },
        ),
      ),
    );

    const summary = await runQueueReplay({ fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(summary.failed).toBe(1);
    const [item] = await listQueue(["conflict"]);
    expect(item?.next_retry_at).toBeNull();
  });

  it("processes multiple pending items in one pass, up to batchSize", async () => {
    for (let i = 0; i < 3; i++) {
      await enqueueReport(makeDraft({ clientReportId: crypto.randomUUID() }), null);
    }

    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ ok: true, data: { report: { id: crypto.randomUUID() } }, requestId: "req-5" }),
          { status: 200 },
        ),
      ),
    );

    const summary = await runQueueReplay({ fetchImpl: fetchImpl as unknown as typeof fetch, batchSize: 2 });

    expect(summary.claimed).toBe(2);
    expect(summary.succeeded).toBe(2);
  });

  it("reports progress events for each item processed", async () => {
    await enqueueReport(makeDraft(), null);
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true, data: { report: { id: "server-3" } }, requestId: "req-6" }), {
          status: 200,
        }),
      ),
    );
    const events: string[] = [];

    await runQueueReplay({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      onProgress: (event) => events.push(event.type),
    });

    expect(events).toEqual(["sync-started", "item-started", "item-succeeded", "sync-finished"]);
  });
});
