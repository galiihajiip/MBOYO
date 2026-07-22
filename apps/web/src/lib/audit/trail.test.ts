import { describe, expect, it } from "vitest";
import { createFakeDb } from "../reports/service/test-support/fake-db";
import { getAuditEventById, listAuditEvents } from "./trail";

const AUDIT_EVENT_ROW = {
  id: "audit-1",
  entity_type: "report",
  entity_id: "report-1",
  actor_profile_id: "profile-1",
  action: "report.verified",
  detail: { note: "confirmed" },
  occurred_at: "2026-07-26T00:00:00.000Z",
};

describe("listAuditEvents", () => {
  it("returns audit event DTOs", async () => {
    const fakeDb = createFakeDb({ from: { audit_events: () => ({ data: [AUDIT_EVENT_ROW], error: null }) } });

    const result = await listAuditEvents(fakeDb as never, {});
    expect(result).toHaveLength(1);
    expect(result[0]?.action).toBe("report.verified");
  });

  it("applies entityType/action/actorProfileId as eq filters", async () => {
    let capturedBuilder: { calls: Array<{ method: string; args: unknown[] }> } | undefined;
    const fakeDb = createFakeDb({ from: { audit_events: () => ({ data: [], error: null }) } });
    const originalFrom = fakeDb.from.bind(fakeDb);
    fakeDb.from = (table: string) => {
      const builder = originalFrom(table);
      capturedBuilder = builder;
      return builder;
    };

    await listAuditEvents(fakeDb as never, { entityType: "report", action: "report.verified", actorProfileId: "profile-1" });

    expect(capturedBuilder?.calls.filter((c) => c.method === "eq")).toHaveLength(3);
  });

  it("throws ApiError('internal_error') on a query error", async () => {
    const fakeDb = createFakeDb({
      from: { audit_events: () => ({ data: null, error: { message: "connection reset" } }) },
    });

    await expect(listAuditEvents(fakeDb as never, {})).rejects.toMatchObject({ code: "internal_error" });
  });
});

describe("getAuditEventById", () => {
  it("returns the event DTO when found", async () => {
    const fakeDb = createFakeDb({ from: { audit_events: () => ({ data: AUDIT_EVENT_ROW, error: null }) } });

    const result = await getAuditEventById(fakeDb as never, "audit-1");
    expect(result.id).toBe("audit-1");
  });

  it("throws ApiError('not_found') when the event doesn't exist", async () => {
    const fakeDb = createFakeDb({ from: { audit_events: () => ({ data: null, error: null }) } });

    await expect(getAuditEventById(fakeDb as never, "missing")).rejects.toMatchObject({ code: "not_found" });
  });
});
