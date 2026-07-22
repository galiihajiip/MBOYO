import type { NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "../../../../../lib/supabase/server";
import { requireApiRole } from "../../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../../lib/api/respond";
import { resolveRequestId } from "../../../../../lib/api/request-id";
import { ApiError } from "../../../../../lib/api/errors";

export const dynamic = "force-dynamic";

const simulateClusterEscalationSchema = z.object({
  disasterEventId: z.string().uuid(),
  centerLongitude: z.number().min(-180).max(180),
  centerLatitude: z.number().min(-90).max(90),
});

interface ReportRow {
  id: string;
}

/** Demo tool (BLOCK 25) — deterministically triggers the cluster_destroyed_radius escalation rule. System Administrator only. */
export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiRole("system_administrator");
    const supabase = await createServerSupabaseClient();
    const body: unknown = await request.json().catch(() => null);
    const input = simulateClusterEscalationSchema.parse(body);

    const { data, error } = await supabase
      .rpc("simulate_cluster_destroyed_escalation", {
        p_disaster_event_id: input.disasterEventId,
        p_center_longitude: input.centerLongitude,
        p_center_latitude: input.centerLatitude,
      })
      .returns<ReportRow[]>();

    if (error) {
      throw new ApiError("internal_error", "Gagal mensimulasikan eskalasi klaster.");
    }

    return respondOk({ reports: data ?? [] }, requestId, 201);
  } catch (error) {
    return respondError(error, requestId);
  }
}
