import { describe, expect, it, vi } from "vitest";
import { createFakeDb } from "../reports/service/test-support/fake-db";

vi.mock("../env.server", () => ({
  getServerEnv: () => ({ SUPABASE_EXPORTS_BUCKET: "generated-exports" }),
}));

import { createExportJob, listExportJobs } from "./exports";

const JOB_ROW = {
  id: "job-1",
  requested_by_profile_id: "profile-1",
  disaster_event_id: "event-1",
  format: "csv" as const,
  filter_criteria: {},
  status: "processing" as const,
  storage_path: null,
  created_at: "2026-07-23T00:00:00.000Z",
  completed_at: null,
};

const SOURCE_ROW = {
  id: "report-1",
  description: "Rumah roboh",
  status: "verified",
  submitted_at: "2026-07-23T00:00:00.000Z",
  longitude: 106.8,
  latitude: -6.2,
  top_severity: "destroyed",
};

describe("createExportJob", () => {
  it("creates the job, uploads the file, records an audit event, and returns it as done with a signed URL", async () => {
    const fakeDb = createFakeDb({
      from: {
        export_jobs: [
          () => ({ data: JOB_ROW, error: null }),
          () => ({ data: null, error: null }),
          () => ({ data: { ...JOB_ROW, status: "done", storage_path: "event-1/job-1.csv", completed_at: "2026-07-23T00:01:00.000Z" }, error: null }),
        ],
        command_map_reports: () => ({ data: [SOURCE_ROW], error: null }),
      },
      rpc: { append_audit_event: () => ({ data: { id: "audit-1" }, error: null }) },
      storageUpload: { "generated-exports": () => ({ error: null }) },
      storageSignedUrl: {
        "generated-exports": (path) => ({ data: { signedUrl: `https://signed.example/${path}` }, error: null }),
      },
    });

    const result = await createExportJob(fakeDb as never, "profile-1", {
      disasterEventId: "event-1",
      format: "csv",
      filterCriteria: {},
    });

    expect(result.status).toBe("done");
    expect(result.signedUrl).toBe("https://signed.example/event-1/job-1.csv");
    expect(fakeDb.rpcCalls.some((call) => call.fn === "append_audit_event")).toBe(true);
  });

  it("generates a JSON export when format is json", async () => {
    const fakeDb = createFakeDb({
      from: {
        export_jobs: [
          () => ({ data: { ...JOB_ROW, format: "json" }, error: null }),
          () => ({ data: null, error: null }),
          () => ({ data: { ...JOB_ROW, format: "json", status: "done", storage_path: "event-1/job-1.json" }, error: null }),
        ],
        command_map_reports: () => ({ data: [SOURCE_ROW], error: null }),
      },
      rpc: { append_audit_event: () => ({ data: { id: "audit-1" }, error: null }) },
      storageUpload: { "generated-exports": () => ({ error: null }) },
      storageSignedUrl: { "generated-exports": () => ({ data: { signedUrl: "https://signed.example/x" }, error: null }) },
    });

    const result = await createExportJob(fakeDb as never, "profile-1", {
      disasterEventId: "event-1",
      format: "json",
      filterCriteria: {},
    });

    expect(result.format).toBe("json");
  });

  it("redacts fields not in the requested allowlist", async () => {
    let capturedContent = "";
    const fakeDb = createFakeDb({
      from: {
        export_jobs: [
          () => ({ data: JOB_ROW, error: null }),
          () => ({ data: null, error: null }),
          () => ({ data: { ...JOB_ROW, status: "done" }, error: null }),
        ],
        command_map_reports: () => ({ data: [SOURCE_ROW], error: null }),
      },
      rpc: { append_audit_event: () => ({ data: { id: "audit-1" }, error: null }) },
      storageUpload: {
        "generated-exports": (_path, body) => {
          capturedContent = String(body);
          return { error: null };
        },
      },
      storageSignedUrl: { "generated-exports": () => ({ data: { signedUrl: "https://signed.example/x" }, error: null }) },
    });

    await createExportJob(fakeDb as never, "profile-1", {
      disasterEventId: "event-1",
      format: "json",
      filterCriteria: {},
      fields: ["reportId", "status"],
    });

    const parsed = JSON.parse(capturedContent) as Record<string, unknown>[];
    expect(Object.keys(parsed[0] ?? {})).toEqual(["reportId", "status"]);
  });

  it("throws when the source data query errors, after marking the job failed", async () => {
    const fakeDb = createFakeDb({
      from: {
        export_jobs: [
          () => ({ data: JOB_ROW, error: null }),
          () => ({ data: null, error: { message: "connection reset" } }),
        ],
        command_map_reports: () => ({ data: null, error: { message: "connection reset" } }),
      },
    });

    await expect(
      createExportJob(fakeDb as never, "profile-1", { disasterEventId: "event-1", format: "csv", filterCriteria: {} }),
    ).rejects.toMatchObject({ code: "internal_error" });
  });

  it("throws when the storage upload fails", async () => {
    const fakeDb = createFakeDb({
      from: {
        export_jobs: [
          () => ({ data: JOB_ROW, error: null }),
          () => ({ data: null, error: null }),
        ],
        command_map_reports: () => ({ data: [], error: null }),
      },
      storageUpload: { "generated-exports": () => ({ error: { message: "storage outage" } }) },
    });

    await expect(
      createExportJob(fakeDb as never, "profile-1", { disasterEventId: "event-1", format: "geojson", filterCriteria: {} }),
    ).rejects.toMatchObject({ code: "internal_error" });
  });
});

describe("listExportJobs", () => {
  it("returns export job DTOs with a null signedUrl (not regenerated for list views)", async () => {
    const fakeDb = createFakeDb({ from: { export_jobs: () => ({ data: [JOB_ROW], error: null }) } });

    const result = await listExportJobs(fakeDb as never);
    expect(result).toHaveLength(1);
    expect(result[0]?.signedUrl).toBeNull();
  });

  it("throws ApiError('internal_error') on a query error", async () => {
    const fakeDb = createFakeDb({
      from: { export_jobs: () => ({ data: null, error: { message: "connection reset" } }) },
    });

    await expect(listExportJobs(fakeDb as never)).rejects.toMatchObject({ code: "internal_error" });
  });
});
