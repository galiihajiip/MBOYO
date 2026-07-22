import type { NextRequest } from "next/server";
import { createIncidentClusterSchema } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { requireApiPermission } from "../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../lib/api/respond";
import { resolveRequestId } from "../../../../lib/api/request-id";
import { createIncidentCluster, listClusterSummaries } from "../../../../lib/command/clusters";

export const dynamic = "force-dynamic";

/** Lists cluster summaries (Peta Krisis markers, Prioritas list) — optionally scoped to one disaster event. */
export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiPermission("incident_cluster", "create");
    const supabase = await createServerSupabaseClient();
    const disasterEventId = request.nextUrl.searchParams.get("disasterEventId") ?? undefined;
    const clusters = await listClusterSummaries(supabase, disasterEventId);
    return respondOk({ clusters }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}

/** Creates an incident_cluster from an explicit set of verified reports — always a deliberate Coordinator action. */
export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiPermission("incident_cluster", "create");
    const supabase = await createServerSupabaseClient();
    const body: unknown = await request.json().catch(() => null);
    const input = createIncidentClusterSchema.parse(body);
    const cluster = await createIncidentCluster(supabase, input);
    return respondOk({ cluster }, requestId, 201);
  } catch (error) {
    return respondError(error, requestId);
  }
}
