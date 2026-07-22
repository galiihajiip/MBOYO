import { describe, expect, it } from "vitest";
import { createFakeDb } from "../reports/service/test-support/fake-db";
import { getDisasterEventGeofenceRing, listCommandMapReports } from "./map";

const MAP_REPORT_ROW = {
  id: "report-1",
  disaster_event_id: "event-1",
  description: "Rumah roboh",
  escalated: false,
  submitted_at: "2026-07-23T00:00:00.000Z",
  longitude: 106.8,
  latitude: -6.2,
  top_severity: "destroyed" as const,
  incident_cluster_id: null,
};

describe("listCommandMapReports", () => {
  it("returns command map report DTOs", async () => {
    const fakeDb = createFakeDb({ from: { command_map_reports: () => ({ data: [MAP_REPORT_ROW], error: null }) } });

    const result = await listCommandMapReports(fakeDb as never);
    expect(result).toHaveLength(1);
    expect(result[0]?.topSeverity).toBe("destroyed");
  });

  it("applies bbox filters as gte/lte on longitude/latitude", async () => {
    let capturedBuilder: { calls: Array<{ method: string; args: unknown[] }> } | undefined;
    const fakeDb = createFakeDb({ from: { command_map_reports: () => ({ data: [], error: null }) } });
    const originalFrom = fakeDb.from.bind(fakeDb);
    fakeDb.from = (table: string) => {
      const builder = originalFrom(table);
      capturedBuilder = builder;
      return builder;
    };

    await listCommandMapReports(fakeDb as never, { bbox: { minLon: 1, minLat: 2, maxLon: 3, maxLat: 4 } });

    expect(capturedBuilder?.calls.find((c) => c.method === "gte" && c.args[0] === "longitude")?.args).toEqual([
      "longitude",
      1,
    ]);
    expect(capturedBuilder?.calls.find((c) => c.method === "lte" && c.args[0] === "latitude")?.args).toEqual([
      "latitude",
      4,
    ]);
  });

  it("throws ApiError('internal_error') on a query error", async () => {
    const fakeDb = createFakeDb({
      from: { command_map_reports: () => ({ data: null, error: { message: "connection reset" } }) },
    });

    await expect(listCommandMapReports(fakeDb as never)).rejects.toMatchObject({ code: "internal_error" });
  });
});

describe("getDisasterEventGeofenceRing", () => {
  it("returns the outer ring when the RPC returns a valid Polygon", async () => {
    const polygon = JSON.stringify({ type: "Polygon", coordinates: [[[1, 2], [3, 4], [5, 6], [1, 2]]] });
    const fakeDb = createFakeDb({ rpc: { disaster_event_geofence_geojson: () => ({ data: polygon, error: null }) } });

    const result = await getDisasterEventGeofenceRing(fakeDb as never, "event-1");
    expect(result).toEqual([[1, 2], [3, 4], [5, 6], [1, 2]]);
  });

  it("returns null when the RPC returns null (no geofence configured)", async () => {
    const fakeDb = createFakeDb({ rpc: { disaster_event_geofence_geojson: () => ({ data: null, error: null }) } });

    const result = await getDisasterEventGeofenceRing(fakeDb as never, "event-1");
    expect(result).toBeNull();
  });

  it("returns null when the RPC errors", async () => {
    const fakeDb = createFakeDb({
      rpc: { disaster_event_geofence_geojson: () => ({ data: null, error: { message: "connection reset" } }) },
    });

    const result = await getDisasterEventGeofenceRing(fakeDb as never, "event-1");
    expect(result).toBeNull();
  });

  it("returns null when the geometry isn't a Polygon", async () => {
    const point = JSON.stringify({ type: "Point", coordinates: [1, 2] });
    const fakeDb = createFakeDb({ rpc: { disaster_event_geofence_geojson: () => ({ data: point, error: null }) } });

    const result = await getDisasterEventGeofenceRing(fakeDb as never, "event-1");
    expect(result).toBeNull();
  });
});
