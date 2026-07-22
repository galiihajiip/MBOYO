import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { requireApiRole } from "../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../lib/api/respond";
import { resolveRequestId } from "../../../../lib/api/request-id";
import { getVerifierAnalytics } from "../../../../lib/reports/service/analytics";

export const dynamic = "force-dynamic";

/** Verifier analytics (BLOCK 26): review count, agreement/override rate, review time, queue age, quality distribution. */
export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiRole("verifier");
    const supabase = await createServerSupabaseClient();
    const analytics = await getVerifierAnalytics(supabase);
    return respondOk({ analytics }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
