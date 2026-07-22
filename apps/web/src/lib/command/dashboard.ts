import "server-only";
import { ApiError } from "../api/errors";
import { toCommandDashboardMetrics, type CommandDashboardMetrics, type CommandDashboardMetricsRow, type CommandDbClient } from "./types";

export async function getCommandDashboardMetrics(db: CommandDbClient): Promise<CommandDashboardMetrics> {
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    return {
      verifiedIncidentCount: 42,
      criticalClusterCount: 3,
      unassignedPriorityCount: 5,
      activeTaskCount: 12,
      overdueTaskCount: 1,
      medianResponseTimeSeconds: 1440,
    };
  }

  try {
    const { data, error } = await db.from("command_dashboard_metrics").select("*").single<CommandDashboardMetricsRow>();
    if (!error && data) {
      return toCommandDashboardMetrics(data);
    }
  } catch {}

  throw new ApiError("internal_error", "Gagal memuat metrik dasbor koordinator.");
}
