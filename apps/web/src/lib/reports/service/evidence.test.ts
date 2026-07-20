import { describe, expect, it, vi } from "vitest";
import { createFakeDb } from "./test-support/fake-db";
import { ApiError } from "../../api/errors";

vi.mock("../../env.server", () => ({
  getServerEnv: () => ({ SUPABASE_REPORTS_BUCKET: "reports" }),
}));

import { listReportEvidence } from "./evidence";

const EVIDENCE_ROW = {
  id: "evidence-1",
  report_id: "report-1",
  storage_path: "report-1/hash123",
  thumbnail_path: "report-1/thumb-hash123",
  mime_type: "image/jpeg",
  size_bytes: 204800,
  width_px: 1920,
  height_px: 1080,
  is_duplicate_hash: false,
  uploaded_at: "2026-07-17T00:00:00.000Z",
};

describe("listReportEvidence", () => {
  it("returns evidence DTOs with fresh signed URLs for the image and thumbnail", async () => {
    const fakeDb = createFakeDb({
      from: { report_evidence: () => ({ data: [EVIDENCE_ROW], error: null }) },
      storageSignedUrl: {
        reports: (path) => ({ data: { signedUrl: `https://signed.example/${path}` }, error: null }),
      },
    });

    const result = await listReportEvidence(fakeDb as never, "report-1");

    expect(result).toHaveLength(1);
    expect(result[0]?.signedUrl).toBe("https://signed.example/report-1/hash123");
    expect(result[0]?.thumbnailSignedUrl).toBe("https://signed.example/report-1/thumb-hash123");
    expect(result[0]?.isDuplicateHash).toBe(false);
  });

  it("returns an empty array when the report has no evidence rows", async () => {
    const fakeDb = createFakeDb({
      from: { report_evidence: () => ({ data: [], error: null }) },
    });

    const result = await listReportEvidence(fakeDb as never, "report-1");
    expect(result).toEqual([]);
  });

  it("omits a row whose object can't be signed rather than failing the whole page", async () => {
    const fakeDb = createFakeDb({
      from: { report_evidence: () => ({ data: [EVIDENCE_ROW], error: null }) },
      storageSignedUrl: {
        reports: () => ({ data: null, error: { message: "storage outage" } }),
      },
    });

    const result = await listReportEvidence(fakeDb as never, "report-1");
    expect(result).toEqual([]);
  });

  it("leaves thumbnailSignedUrl null when no thumbnail_path was recorded", async () => {
    const fakeDb = createFakeDb({
      from: { report_evidence: () => ({ data: [{ ...EVIDENCE_ROW, thumbnail_path: null }], error: null }) },
      storageSignedUrl: {
        reports: (path) => ({ data: { signedUrl: `https://signed.example/${path}` }, error: null }),
      },
    });

    const result = await listReportEvidence(fakeDb as never, "report-1");
    expect(result[0]?.thumbnailSignedUrl).toBeNull();
  });

  it("throws ApiError('internal_error') on a query error", async () => {
    const fakeDb = createFakeDb({
      from: { report_evidence: () => ({ data: null, error: { message: "connection reset" } }) },
    });

    await expect(listReportEvidence(fakeDb as never, "report-1")).rejects.toBeInstanceOf(ApiError);
    await expect(listReportEvidence(fakeDb as never, "report-1")).rejects.toMatchObject({ code: "internal_error" });
  });
});
