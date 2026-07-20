import { describe, expect, it } from "vitest";
import { createFakeDb } from "./test-support/fake-db";
import { getReportById } from "./detail";
import { ApiError } from "../../api/errors";

const REPORT_ROW = {
  id: "report-1",
  client_report_id: "client-1",
  reporter_profile_id: "profile-1",
  disaster_event_id: "event-1",
  status: "verified",
  description: "Jalan terputus akibat longsor",
  created_at_client: null,
  submitted_at: "2026-07-17T00:00:00.000Z",
  archived_at: null,
  created_at: "2026-07-17T00:00:00.000Z",
  updated_at: "2026-07-17T00:00:00.000Z",
};

describe("getReportById", () => {
  it("returns the report DTO when the row is visible (returned by the RLS-scoped query)", async () => {
    const fakeDb = createFakeDb({
      from: { reports: () => ({ data: REPORT_ROW, error: null }) },
    });

    const result = await getReportById(fakeDb as never, "report-1");
    expect(result.id).toBe("report-1");
    expect(result.status).toBe("verified");
  });

  it("throws ApiError('not_found') when the row is absent — same as RLS hiding a row not owned/visible to the caller", async () => {
    const fakeDb = createFakeDb({
      from: { reports: () => ({ data: null, error: null }) },
    });

    await expect(getReportById(fakeDb as never, "someone-elses-report")).rejects.toBeInstanceOf(ApiError);
    await expect(getReportById(fakeDb as never, "someone-elses-report")).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
