import type { NextRequest } from "next/server";
import { setPrioritySchema } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../../../../lib/supabase/server";
import { requireApiPermission } from "../../../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../../../lib/api/respond";
import { resolveRequestId } from "../../../../../../lib/api/request-id";
import { setIncidentClusterPriority } from "../../../../../../lib/command/clusters";

export const dynamic = "force-dynamic";

/** Sets/changes a cluster's operational priority — critical requires a reason, always audited. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ clusterId: string }> }) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiPermission("incident_cluster", "update");
    const supabase = await createServerSupabaseClient();
    const { clusterId } = await params;
    const body: unknown = await request.json().catch(() => null);
    const input = setPrioritySchema.parse(body);
    const cluster = await setIncidentClusterPriority(supabase, clusterId, input);
    return respondOk({ cluster }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
