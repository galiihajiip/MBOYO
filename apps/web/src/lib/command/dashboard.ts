import "server-only";
import { ApiError } from "../api/errors";
import { toCommandDashboardMetrics, type CommandDashboardMetrics, type CommandDashboardMetricsRow, type CommandDbClient } from "./types";

/**
 * The Command Center dashboard's six metrics — a single-row read of
 * public.command_dashboard_metrics (BLOCK 24 migration). One cheap query,
 * not six separate counts (unlike BLOCK 23's Verifier dashboard, which
 * needed six independently-filterable counts against a queue view) since
 * every metric here is scoped to the whole verified/task dataset, not a
 * per-status queue.
 */
export async function getCommandDashboardMetrics(db: CommandDbClient): Promise<CommandDashboardMetrics> {
  const { data, error } = await db.from("command_dashboard_metrics").select("*").single<CommandDashboardMetricsRow>();

  if (error) {
    throw new ApiError("internal_error", "Gagal memuat metrik dasbor koordinator.");
  }

  return toCommandDashboardMetrics(data);
}
