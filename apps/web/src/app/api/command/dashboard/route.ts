import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { requireApiRole } from "../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../lib/api/respond";
import { resolveRequestId } from "../../../../lib/api/request-id";
import { getCommandDashboardMetrics } from "../../../../lib/command/dashboard";

export const dynamic = "force-dynamic";

/** The Command Center's six Ringkasan metrics. */
export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiRole("response_coordinator");
    const supabase = await createServerSupabaseClient();
    const metrics = await getCommandDashboardMetrics(supabase);
    return respondOk({ metrics }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
