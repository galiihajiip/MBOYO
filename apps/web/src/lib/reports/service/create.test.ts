import { describe, expect, it } from "vitest";
import { createFakeDb } from "./test-support/fake-db";
import { createReport } from "./create";
import { ApiError } from "../../api/errors";

const BASE_INPUT = {
  clientReportId: "11111111-1111-1111-1111-111111111111",
  eventId: "22222222-2222-2222-2222-222222222222",
  description: "Rumah roboh sebagian",
  createdAtClient: undefined,
};

const REPORT_ROW = {
  id: "33333333-3333-3333-3333-333333333333",
  client_report_id: BASE_INPUT.clientReportId,
  reporter_profile_id: "profile-1",
  disaster_event_id: BASE_INPUT.eventId,
  status: "submitted",
  description: BASE_INPUT.description,
  created_at_client: "2026-07-17T00:00:00.000Z",
  submitted_at: "2026-07-17T00:00:00.000Z",
  archived_at: null,
  created_at: "2026-07-17T00:00:00.000Z",
  updated_at: "2026-07-17T00:00:00.000Z",
};

describe("createReport", () => {
  it("creates a new report and appends a report.created audit event on first insert", async () => {
    const fakeDb = createFakeDb({
      from: {
        reports: [
          () => ({ data: null, error: null }), // existence check: not found
          () => ({ data: REPORT_ROW, error: null }), // upsert result
        ],
      },
      rpc: {
        append_audit_event: () => ({ data: { id: "audit-1" }, error: null }),
      },
    });

    const result = await createReport(fakeDb as never, "profile-1", BASE_INPUT);

    expect(result.id).toBe(REPORT_ROW.id);
    expect(result.status).toBe("submitted");
    expect(fakeDb.rpcCalls).toHaveLength(1);
    expect(fakeDb.rpcCalls[0]?.fn).toBe("append_audit_event");
    expect(fakeDb.rpcCalls[0]?.args).toMatchObject({ p_action: "report.created" });
  });

  it("does NOT append a duplicate audit event when the report already existed (idempotent retry)", async () => {
    const fakeDb = createFakeDb({
      from: {
        reports: [
          () => ({ data: { id: REPORT_ROW.id }, error: null }), // existence check: found
          () => ({ data: REPORT_ROW, error: null }), // upsert result (no-op update)
        ],
      },
      rpc: {
        append_audit_event: () => ({ data: { id: "audit-1" }, error: null }),
      },
    });

    const result = await createReport(fakeDb as never, "profile-1", BASE_INPUT);

    expect(result.id).toBe(REPORT_ROW.id);
    expect(fakeDb.rpcCalls).toHaveLength(0);
  });

  it("throws ApiError('internal_error') when the upsert fails", async () => {
    const fakeDb = createFakeDb({
      from: {
        reports: [
          () => ({ data: null, error: null }),
          () => ({ data: null, error: { message: "constraint violation" } }),
        ],
      },
    });

    await expect(createReport(fakeDb as never, "profile-1", BASE_INPUT)).rejects.toBeInstanceOf(ApiError);
    await expect(createReport(fakeDb as never, "profile-1", BASE_INPUT)).rejects.toMatchObject({
      code: "internal_error",
    });
  });
});
