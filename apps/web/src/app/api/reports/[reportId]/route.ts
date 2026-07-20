import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { requireApiPermission } from "../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../lib/api/respond";
import { resolveRequestId } from "../../../../lib/api/request-id";
import { getReportById } from "../../../../lib/reports/service/detail";

export const dynamic = "force-dynamic";

/**
 * Reporter's own report detail — "own report detail" domain service.
 * Shared with the Verifier detail route's underlying getReportById(); the
 * only difference is RLS visibility (reports_reporter_select_own vs.
 * reports_verifier_select_all, BLOCK 08), so a Reporter requesting a
 * report they don't own gets the same not_found ApiError as a nonexistent
 * id — RLS makes the two indistinguishable by design, which is correct
 * here (never confirm "this id exists but isn't yours").
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  const requestId = resolveRequestId(request);

  try {
    await requireApiPermission("report", "read");
    const supabase = await createServerSupabaseClient();
    const { reportId } = await params;

    const report = await getReportById(supabase, reportId);
    return respondOk({ report }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
