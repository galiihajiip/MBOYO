import type { NextRequest } from "next/server";
import { addReportsToClusterSchema } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../../../../lib/supabase/server";
import { requireApiPermission } from "../../../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../../../lib/api/respond";
import { resolveRequestId } from "../../../../../../lib/api/request-id";
import { addReportsToCluster } from "../../../../../../lib/command/clusters";

export const dynamic = "force-dynamic";

/** Extends an existing cluster with more verified reports (same one-cluster-per-report invariant). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ clusterId: string }> }) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiPermission("incident_cluster", "update");
    const supabase = await createServerSupabaseClient();
    const { clusterId } = await params;
    const body: unknown = await request.json().catch(() => null);
    const input = addReportsToClusterSchema.parse(body);
    const cluster = await addReportsToCluster(supabase, clusterId, input);
    return respondOk({ cluster }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
