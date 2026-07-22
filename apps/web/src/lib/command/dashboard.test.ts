import { describe, expect, it } from "vitest";
import { createFakeDb } from "../reports/service/test-support/fake-db";
import { getCommandDashboardMetrics } from "./dashboard";

const METRICS_ROW = {
  verified_incident_count: 10,
  critical_cluster_count: 2,
  unassigned_priority_count: 3,
  active_task_count: 5,
  overdue_task_count: 1,
  median_response_time_seconds: 3600,
};

describe("getCommandDashboardMetrics", () => {
  it("returns the metrics converted from the single-row view", async () => {
    const fakeDb = createFakeDb({
      from: { command_dashboard_metrics: () => ({ data: METRICS_ROW, error: null }) },
    });

    const result = await getCommandDashboardMetrics(fakeDb as never);
    expect(result).toEqual({
      verifiedIncidentCount: 10,
      criticalClusterCount: 2,
      unassignedPriorityCount: 3,
      activeTaskCount: 5,
      overdueTaskCount: 1,
      medianResponseTimeSeconds: 3600,
    });
  });

  it("preserves a null median response time (no completed tasks yet)", async () => {
    const fakeDb = createFakeDb({
      from: { command_dashboard_metrics: () => ({ data: { ...METRICS_ROW, median_response_time_seconds: null }, error: null }) },
    });

    const result = await getCommandDashboardMetrics(fakeDb as never);
    expect(result.medianResponseTimeSeconds).toBeNull();
  });

  it("throws ApiError('internal_error') on a query error", async () => {
    const fakeDb = createFakeDb({
      from: { command_dashboard_metrics: () => ({ data: null, error: { message: "connection reset" } }) },
    });

    await expect(getCommandDashboardMetrics(fakeDb as never)).rejects.toMatchObject({ code: "internal_error" });
  });
});
