import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../../../../lib/supabase/server";
import { requireApiRole } from "../../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../../lib/api/respond";
import { resolveRequestId } from "../../../../../lib/api/request-id";
import { getReportById } from "../../../../../lib/reports/service/detail";

export const dynamic = "force-dynamic";

/**
 * Verifier's report detail — "verifier queue/detail" domain service.
 * Shares getReportById() with the Reporter's own-detail route; RLS
 * (reports_verifier_select_all, BLOCK 08) is what lets a Verifier see any
 * report regardless of status, unlike the Reporter route's own-only scope.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  const requestId = resolveRequestId(request);

  try {
    await requireApiRole("verifier");
    const supabase = await createServerSupabaseClient();
    const { reportId } = await params;

    const report = await getReportById(supabase, reportId);
    return respondOk({ report }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
