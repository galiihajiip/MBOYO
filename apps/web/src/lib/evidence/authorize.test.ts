import { describe, expect, it, vi } from "vitest";
import { createFakeDb } from "../reports/service/test-support/fake-db";
import { authorizeEvidenceUpload } from "./authorize";
import type { EvidenceError } from "./errors";

function mockSupabase(db: ReturnType<typeof createFakeDb>, user: { id: string } | null) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: db.from.bind(db),
  } as never;
}

const REPORT_ID = "report-1";

describe("authorizeEvidenceUpload", () => {
  it("throws EvidenceError('unauthenticated', 401) when there is no session", async () => {
    const db = createFakeDb({});
    const supabase = mockSupabase(db, null);

    await expect(authorizeEvidenceUpload(supabase, REPORT_ID)).rejects.toMatchObject({
      code: "unauthenticated",
      httpStatus: 401,
    } satisfies Partial<EvidenceError>);
  });

  it("throws EvidenceError('unauthenticated', 401) when no profile row is found", async () => {
    const db = createFakeDb({
      from: { profiles: () => ({ data: null, error: null }) },
    });
    const supabase = mockSupabase(db, { id: "user-1" });

    await expect(authorizeEvidenceUpload(supabase, REPORT_ID)).rejects.toMatchObject({
      code: "unauthenticated",
      httpStatus: 401,
    });
  });

  it("throws EvidenceError('report_not_found', 404) when the report doesn't exist (or isn't visible via RLS)", async () => {
    const db = createFakeDb({
      from: {
        profiles: () => ({ data: { id: "profile-1" }, error: null }),
        reports: () => ({ data: null, error: null }),
      },
    });
    const supabase = mockSupabase(db, { id: "user-1" });

    await expect(authorizeEvidenceUpload(supabase, REPORT_ID)).rejects.toMatchObject({
      code: "report_not_found",
      httpStatus: 404,
    });
  });

  it("throws EvidenceError('report_not_owned', 403) when the report belongs to a different reporter", async () => {
    const db = createFakeDb({
      from: {
        profiles: () => ({ data: { id: "profile-1" }, error: null }),
        reports: () => ({
          data: { id: REPORT_ID, reporter_profile_id: "someone-else", disaster_event_id: "event-1", status: "submitted" },
          error: null,
        }),
      },
    });
    const supabase = mockSupabase(db, { id: "user-1" });

    await expect(authorizeEvidenceUpload(supabase, REPORT_ID)).rejects.toMatchObject({
      code: "report_not_owned",
      httpStatus: 403,
    });
  });

  it("throws EvidenceError('event_not_found', 404) when the referenced disaster event doesn't exist", async () => {
    const db = createFakeDb({
      from: {
        profiles: () => ({ data: { id: "profile-1" }, error: null }),
        reports: () => ({
          data: { id: REPORT_ID, reporter_profile_id: "profile-1", disaster_event_id: "event-1", status: "submitted" },
          error: null,
        }),
        disaster_events: () => ({ data: null, error: null }),
      },
    });
    const supabase = mockSupabase(db, { id: "user-1" });

    await expect(authorizeEvidenceUpload(supabase, REPORT_ID)).rejects.toMatchObject({
      code: "event_not_found",
      httpStatus: 404,
    });
  });

  it("throws EvidenceError('event_not_active', 409) when the disaster event is closed", async () => {
    const db = createFakeDb({
      from: {
        profiles: () => ({ data: { id: "profile-1" }, error: null }),
        reports: () => ({
          data: { id: REPORT_ID, reporter_profile_id: "profile-1", disaster_event_id: "event-1", status: "submitted" },
          error: null,
        }),
        disaster_events: () => ({ data: { id: "event-1", status: "closed" }, error: null }),
      },
    });
    const supabase = mockSupabase(db, { id: "user-1" });

    await expect(authorizeEvidenceUpload(supabase, REPORT_ID)).rejects.toMatchObject({
      code: "event_not_active",
      httpStatus: 409,
    });
  });

  it("returns profileId and the report row when every check passes", async () => {
    const reportRow = { id: REPORT_ID, reporter_profile_id: "profile-1", disaster_event_id: "event-1", status: "submitted" };
    const db = createFakeDb({
      from: {
        profiles: () => ({ data: { id: "profile-1" }, error: null }),
        reports: () => ({ data: reportRow, error: null }),
        disaster_events: () => ({ data: { id: "event-1", status: "active" }, error: null }),
      },
    });
    const supabase = mockSupabase(db, { id: "user-1" });

    const result = await authorizeEvidenceUpload(supabase, REPORT_ID);
    expect(result).toEqual({ profileId: "profile-1", report: reportRow });
  });
});
