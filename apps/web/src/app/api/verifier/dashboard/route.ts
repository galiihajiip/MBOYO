import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { requireApiRole } from "../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../lib/api/respond";
import { resolveRequestId } from "../../../../lib/api/request-id";
import { getVerifierDashboardMetrics } from "../../../../lib/reports/service/dashboard";

export const dynamic = "force-dynamic";

/**
 * Ringkasan (Verifier dashboard) metrics — BLOCK 23. Read-only; RLS on the
 * underlying verifier_report_queue view/verification_reviews table is the
 * authorization boundary, same as every other Verifier read route.
 */
export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request);

  try {
    await requireApiRole("verifier");
    const supabase = await createServerSupabaseClient();

    const metrics = await getVerifierDashboardMetrics(supabase);
    return respondOk({ metrics }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
