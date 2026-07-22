import { describe, expect, it } from "vitest";
import { createFakeDb } from "../reports/service/test-support/fake-db";
import { ApiError } from "../api/errors";
import { addReportsToCluster, createIncidentCluster, getClusterSummary, listClusterSummaries, setIncidentClusterPriority } from "./clusters";

const CLUSTER_ROW = {
  id: "cluster-1",
  disaster_event_id: "event-1",
  label: "Klaster Kecamatan Utara",
  priority: "unassigned" as const,
  created_by_profile_id: "profile-1",
  created_at: "2026-07-23T00:00:00.000Z",
};

const CLUSTER_SUMMARY_ROW = {
  ...CLUSTER_ROW,
  member_count: 3,
  severity_mix: { destroyed: 2, major_damage: 1 },
  evidence_count: 5,
  centroid_longitude: 106.8,
  centroid_latitude: -6.2,
  task_count: 1,
};

describe("createIncidentCluster", () => {
  it("returns the created cluster DTO on success", async () => {
    const fakeDb = createFakeDb({ rpc: { create_incident_cluster: () => ({ data: CLUSTER_ROW, error: null }) } });

    const result = await createIncidentCluster(fakeDb as never, {
      disasterEventId: "event-1",
      label: "Klaster Kecamatan Utara",
      reportIds: ["report-1"],
    });

    expect(result.id).toBe("cluster-1");
    expect(result.label).toBe("Klaster Kecamatan Utara");
  });

  it("maps a 22023 (validation) error to ApiError('validation_failed')", async () => {
    const fakeDb = createFakeDb({
      rpc: { create_incident_cluster: () => ({ data: null, error: { code: "22023", message: "label is required" } }) },
    });

    await expect(
      createIncidentCluster(fakeDb as never, { disasterEventId: "event-1", label: "x", reportIds: ["r1"] }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("maps a P0001 (precondition failed) error to ApiError('invalid_transition')", async () => {
    const fakeDb = createFakeDb({
      rpc: {
        create_incident_cluster: () => ({ data: null, error: { code: "P0001", message: "already clustered" } }),
      },
    });

    await expect(
      createIncidentCluster(fakeDb as never, { disasterEventId: "event-1", label: "x", reportIds: ["r1"] }),
    ).rejects.toMatchObject({ code: "invalid_transition" });
  });

  it("maps a 42501 (insufficient privilege) error to ApiError('forbidden')", async () => {
    const fakeDb = createFakeDb({
      rpc: { create_incident_cluster: () => ({ data: null, error: { code: "42501", message: "no role" } }) },
    });

    await expect(
      createIncidentCluster(fakeDb as never, { disasterEventId: "event-1", label: "x", reportIds: ["r1"] }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("maps an unrecognized error to ApiError('internal_error')", async () => {
    const fakeDb = createFakeDb({
      rpc: { create_incident_cluster: () => ({ data: null, error: { message: "connection reset" } }) },
    });

    await expect(
      createIncidentCluster(fakeDb as never, { disasterEventId: "event-1", label: "x", reportIds: ["r1"] }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe("addReportsToCluster", () => {
  it("returns the updated cluster DTO on success", async () => {
    const fakeDb = createFakeDb({ rpc: { add_reports_to_cluster: () => ({ data: CLUSTER_ROW, error: null }) } });

    const result = await addReportsToCluster(fakeDb as never, "cluster-1", { reportIds: ["report-2"] });
    expect(result.id).toBe("cluster-1");
  });

  it("maps a not-found error to ApiError('not_found')", async () => {
    const fakeDb = createFakeDb({
      rpc: { add_reports_to_cluster: () => ({ data: null, error: { code: "P0002", message: "not found" } }) },
    });

    await expect(addReportsToCluster(fakeDb as never, "missing", { reportIds: ["r1"] })).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("setIncidentClusterPriority", () => {
  it("returns the updated cluster DTO on success", async () => {
    const fakeDb = createFakeDb({
      rpc: { set_incident_cluster_priority: () => ({ data: { ...CLUSTER_ROW, priority: "high" }, error: null }) },
    });

    const result = await setIncidentClusterPriority(fakeDb as never, "cluster-1", { priority: "high" });
    expect(result.priority).toBe("high");
  });

  it("maps a validation error (critical without reason) to ApiError('validation_failed')", async () => {
    const fakeDb = createFakeDb({
      rpc: {
        set_incident_cluster_priority: () => ({
          data: null,
          error: { code: "22023", message: "a reason is required to set critical priority" },
        }),
      },
    });

    await expect(
      setIncidentClusterPriority(fakeDb as never, "cluster-1", { priority: "critical" }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });
});

describe("listClusterSummaries", () => {
  it("returns cluster summary DTOs converted from numeric row shape", async () => {
    const fakeDb = createFakeDb({
      from: { command_cluster_summary: () => ({ data: [CLUSTER_SUMMARY_ROW], error: null }) },
    });

    const result = await listClusterSummaries(fakeDb as never);
    expect(result).toHaveLength(1);
    expect(result[0]?.memberCount).toBe(3);
    expect(result[0]?.severityMix).toEqual({ destroyed: 2, major_damage: 1 });
  });

  it("throws ApiError('internal_error') on a query error", async () => {
    const fakeDb = createFakeDb({
      from: { command_cluster_summary: () => ({ data: null, error: { message: "connection reset" } }) },
    });

    await expect(listClusterSummaries(fakeDb as never)).rejects.toMatchObject({ code: "internal_error" });
  });
});

describe("getClusterSummary", () => {
  it("returns null when the cluster doesn't exist or isn't visible", async () => {
    const fakeDb = createFakeDb({ from: { command_cluster_summary: () => ({ data: null, error: null }) } });

    const result = await getClusterSummary(fakeDb as never, "missing");
    expect(result).toBeNull();
  });

  it("returns the cluster summary DTO when found", async () => {
    const fakeDb = createFakeDb({ from: { command_cluster_summary: () => ({ data: CLUSTER_SUMMARY_ROW, error: null }) } });

    const result = await getClusterSummary(fakeDb as never, "cluster-1");
    expect(result?.id).toBe("cluster-1");
  });
});
