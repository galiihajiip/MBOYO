import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../../../../lib/supabase/server";
import { requireApiPermission } from "../../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../../lib/api/respond";
import { resolveRequestId } from "../../../../../lib/api/request-id";
import { getDecisionLineage } from "../../../../../lib/audit/lineage";

export const dynamic = "force-dynamic";

/** Decision lineage for one report — the full immutable verification_reviews history, including the supersedes_review_id chain. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiPermission("verification_review", "read");
    const supabase = await createServerSupabaseClient();
    const { reportId } = await params;
    const lineage = await getDecisionLineage(supabase, reportId);
    return respondOk({ lineage }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
