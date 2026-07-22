import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { requireApiPermission } from "../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../lib/api/respond";
import { resolveRequestId } from "../../../../lib/api/request-id";
import { getIncidentAnalytics } from "../../../../lib/command/analytics";

export const dynamic = "force-dynamic";

/** Incident breakdown by severity, status, and region (disaster_event) — Analitik. */
export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiPermission("report", "read");
    const supabase = await createServerSupabaseClient();
    const analytics = await getIncidentAnalytics(supabase);
    return respondOk({ analytics }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
