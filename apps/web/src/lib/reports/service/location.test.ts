import { describe, expect, it } from "vitest";
import { createFakeDb } from "./test-support/fake-db";
import { recordLocationObservation, listLocationObservations } from "./location";
import { ApiError } from "../../api/errors";

const OBSERVATION_ROW = {
  id: "obs-1",
  report_id: "report-1",
  longitude: 106.827,
  latitude: -6.175,
  accuracy_meters: "12.50",
  captured_at_client: "2026-07-17T00:00:00.000Z",
  location_source: "gps" as const,
  manual_address: null,
  distance_to_event_center_meters: "340.25",
  outside_event_boundary: false,
  suspicious_pattern_flags: [],
  confidence_signal: "0.900",
  created_at: "2026-07-17T00:00:00.000Z",
};

describe("recordLocationObservation", () => {
  it("returns the observation DTO on success, converting numeric-string columns to numbers", async () => {
    const fakeDb = createFakeDb({
      rpc: { record_geolocation_observation: () => ({ data: OBSERVATION_ROW, error: null }) },
    });

    const result = await recordLocationObservation(fakeDb as never, "report-1", {
      longitude: 106.827,
      latitude: -6.175,
      source: "gps",
    });

    expect(result.accuracyMeters).toBe(12.5);
    expect(result.distanceToEventCenterMeters).toBe(340.25);
    expect(result.outsideEventBoundary).toBe(false);
    expect(result.confidenceSignal).toBe(0.9);
  });

  it("passes longitude before latitude to the RPC — GeoJSON [lon, lat] order", async () => {
    const fakeDb = createFakeDb({
      rpc: { record_geolocation_observation: () => ({ data: OBSERVATION_ROW, error: null }) },
    });

    await recordLocationObservation(fakeDb as never, "report-1", {
      longitude: 106.827,
      latitude: -6.175,
      source: "gps",
    });

    expect(fakeDb.rpcCalls[0]?.args).toMatchObject({ p_longitude: 106.827, p_latitude: -6.175 });
  });

  it("maps a 42501 (insufficient_privilege) Postgres error to ApiError('forbidden')", async () => {
    const fakeDb = createFakeDb({
      rpc: {
        record_geolocation_observation: () => ({
          data: null,
          error: { code: "42501", message: "caller does not own report" },
        }),
      },
    });

    await expect(
      recordLocationObservation(fakeDb as never, "report-1", { longitude: 1, latitude: 1, source: "gps" }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("maps a 22023 (invalid coordinates) Postgres error to ApiError('validation_failed')", async () => {
    const fakeDb = createFakeDb({
      rpc: {
        record_geolocation_observation: () => ({
          data: null,
          error: { code: "22023", message: "coordinates out of range" },
        }),
      },
    });

    await expect(
      recordLocationObservation(fakeDb as never, "report-1", { longitude: 999, latitude: 1, source: "gps" }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("maps an unrecognized Postgres error to ApiError('internal_error')", async () => {
    const fakeDb = createFakeDb({
      rpc: { record_geolocation_observation: () => ({ data: null, error: { message: "connection reset" } }) },
    });

    await expect(
      recordLocationObservation(fakeDb as never, "report-1", { longitude: 1, latitude: 1, source: "gps" }),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(
      recordLocationObservation(fakeDb as never, "report-1", { longitude: 1, latitude: 1, source: "gps" }),
    ).rejects.toMatchObject({ code: "internal_error" });
  });
});

describe("listLocationObservations", () => {
  it("returns observation DTOs converted from numeric-string columns", async () => {
    const fakeDb = createFakeDb({
      from: {
        geolocation_observations: () => ({ data: [OBSERVATION_ROW], error: null }),
      },
    });

    const result = await listLocationObservations(fakeDb as never, "report-1");
    expect(result).toHaveLength(1);
    expect(result[0]?.accuracyMeters).toBe(12.5);
  });

  it("returns an empty array when there are no observations", async () => {
    const fakeDb = createFakeDb({
      from: { geolocation_observations: () => ({ data: [], error: null }) },
    });

    const result = await listLocationObservations(fakeDb as never, "report-1");
    expect(result).toEqual([]);
  });

  it("throws ApiError('internal_error') on a query error", async () => {
    const fakeDb = createFakeDb({
      from: { geolocation_observations: () => ({ data: null, error: { message: "connection reset" } }) },
    });

    await expect(listLocationObservations(fakeDb as never, "report-1")).rejects.toMatchObject({
      code: "internal_error",
    });
  });
});
