import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { requireApiPermission } from "../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../lib/api/respond";
import { resolveRequestId } from "../../../../lib/api/request-id";
import { getGeminiUsageSummary } from "../../../../lib/audit/model-registry";

export const dynamic = "force-dynamic";

/** Org-wide Gemini advisory usage log summary — Auditor's "external advisory" oversight. */
export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiPermission("gemini_advisory_request", "read");
    const supabase = await createServerSupabaseClient();
    const summary = await getGeminiUsageSummary(supabase);
    return respondOk({ summary }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
