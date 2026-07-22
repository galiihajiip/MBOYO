import type { NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "../../../../../lib/supabase/server";
import { requireApiRole } from "../../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../../lib/api/respond";
import { resolveRequestId } from "../../../../../lib/api/request-id";
import { ApiError } from "../../../../../lib/api/errors";

export const dynamic = "force-dynamic";

const simulateDestroyedReportSchema = z.object({
  disasterEventId: z.string().uuid(),
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
});

interface ReportRow {
  id: string;
}

/** Demo tool (BLOCK 25) — simulates one verified destroyed report to exercise the verified_destroyed_threshold escalation rule. System Administrator only. */
export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiRole("system_administrator");
    const supabase = await createServerSupabaseClient();
    const body: unknown = await request.json().catch(() => null);
    const input = simulateDestroyedReportSchema.parse(body);

    const { data, error } = await supabase
      .rpc("simulate_verified_destroyed_report", {
        p_disaster_event_id: input.disasterEventId,
        p_longitude: input.longitude,
        p_latitude: input.latitude,
      })
      .single<ReportRow>();

    if (error || !data) {
      throw new ApiError("internal_error", "Gagal mensimulasikan laporan kerusakan parah.");
    }

    return respondOk({ report: data }, requestId, 201);
  } catch (error) {
    return respondError(error, requestId);
  }
}
