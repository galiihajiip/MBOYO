import "server-only";
import { ApiError } from "../api/errors";
import { toCommandDashboardMetrics, type CommandDashboardMetrics, type CommandDashboardMetricsRow, type CommandDbClient } from "./types";

export async function getCommandDashboardMetrics(db: CommandDbClient): Promise<CommandDashboardMetrics> {
  try {
    const { data, error } = await db.from("command_dashboard_metrics").select("*").single<CommandDashboardMetricsRow>();
    if (!error && data) {
      return toCommandDashboardMetrics(data);
    }
  } catch {}

  throw new ApiError("internal_error", "Gagal memuat metrik dasbor koordinator.");
}
