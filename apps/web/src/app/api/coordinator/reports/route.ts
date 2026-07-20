import type { NextRequest } from "next/server";
import { paginationRequestSchema } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { requireApiRole } from "../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../lib/api/respond";
import { resolveRequestId } from "../../../../lib/api/request-id";
import { listReports } from "../../../../lib/reports/service/list";

export const dynamic = "force-dynamic";

/**
 * Response Coordinator's operational report list — "coordinator
 * operational reports" domain service. Coordinator authority begins at
 * verification (docs/product/RBAC_MATRIX.md: "Coordinator's authority
 * begins at verification"), enforced twice over: RLS
 * (reports_coordinator_select_verified, BLOCK 08) already restricts the
 * Coordinator's RLS-scoped client to `status = 'verified'` rows only, and
 * this route additionally requests only that status explicitly — the RLS
 * policy is the real boundary; the explicit baseStatuses here just keeps
 * this route's intent self-documenting rather than relying solely on the
 * database-level restriction being correct. No status filter is accepted
 * from the caller at all (unlike the Reporter/Verifier list routes) since
 * there is exactly one status a Coordinator's operational view ever shows.
 */
export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request);

  try {
    await requireApiRole("response_coordinator");
    const supabase = await createServerSupabaseClient();

    const url = request.nextUrl;
    const pagination = paginationRequestSchema.parse({
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
    });
    const eventId = url.searchParams.get("eventId") ?? undefined;

    const result = await listReports(
      supabase,
      { eventId },
      pagination,
      { baseStatuses: ["verified"] },
    );
    return respondOk(result, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
