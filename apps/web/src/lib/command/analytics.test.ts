import { describe, expect, it } from "vitest";
import { createFakeDb } from "../reports/service/test-support/fake-db";
import { getIncidentAnalytics } from "./analytics";

describe("getIncidentAnalytics", () => {
  it("aggregates severity, status, and region counts", async () => {
    const fakeDb = createFakeDb({
      from: {
        command_map_reports: () => ({
          data: [{ top_severity: "destroyed" }, { top_severity: "destroyed" }, { top_severity: "minor_damage" }],
          error: null,
        }),
        reports: () => ({
          data: [
            { status: "verified", disaster_event_id: "event-1" },
            { status: "verified", disaster_event_id: "event-1" },
            { status: "rejected", disaster_event_id: "event-2" },
          ],
          error: null,
        }),
        disaster_events: () => ({
          data: [
            { id: "event-1", name: "Gempa Cianjur" },
            { id: "event-2", name: "Banjir Jakarta" },
          ],
          error: null,
        }),
      },
    });

    const result = await getIncidentAnalytics(fakeDb as never);

    expect(result.bySeverity).toEqual({ destroyed: 2, minor_damage: 1 });
    expect(result.byStatus).toEqual({ verified: 2, rejected: 1 });
    expect(result.byRegion).toEqual([
      { disasterEventId: "event-1", name: "Gempa Cianjur", count: 2 },
      { disasterEventId: "event-2", name: "Banjir Jakarta", count: 1 },
    ]);
  });

  it("returns empty breakdowns when there is no data", async () => {
    const fakeDb = createFakeDb({
      from: {
        command_map_reports: () => ({ data: [], error: null }),
        reports: () => ({ data: [], error: null }),
        disaster_events: () => ({ data: [], error: null }),
      },
    });

    const result = await getIncidentAnalytics(fakeDb as never);
    expect(result.bySeverity).toEqual({});
    expect(result.byStatus).toEqual({});
    expect(result.byRegion).toEqual([]);
  });

  it("throws ApiError('internal_error') when the severity query errors", async () => {
    const fakeDb = createFakeDb({
      from: { command_map_reports: () => ({ data: null, error: { message: "connection reset" } }) },
    });

    await expect(getIncidentAnalytics(fakeDb as never)).rejects.toMatchObject({ code: "internal_error" });
  });
});
