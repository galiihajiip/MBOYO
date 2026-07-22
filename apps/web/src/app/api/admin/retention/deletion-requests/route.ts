import type { NextRequest } from "next/server";
import { createDeletionRequestSchema } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../../../lib/supabase/server";
import { requireApiPermission } from "../../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../../lib/api/respond";
import { resolveRequestId } from "../../../../../lib/api/request-id";
import { createDeletionRequest, listDeletionRequests } from "../../../../../lib/admin/retention";

export const dynamic = "force-dynamic";

/** Lists deletion_requests visible to the caller (own for most roles; all for Admin/Auditor). */
export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiPermission("deletion_request", "create");
    const supabase = await createServerSupabaseClient();
    const requests = await listDeletionRequests(supabase);
    return respondOk({ requests }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}

/** Submits a deletion request for the caller's own account/data — placeholder workflow, does not itself delete anything. */
export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    const actor = await requireApiPermission("deletion_request", "create");
    const supabase = await createServerSupabaseClient();
    const body: unknown = await request.json().catch(() => null);
    const input = createDeletionRequestSchema.parse(body);
    const deletionRequest = await createDeletionRequest(supabase, actor.profileId, input);
    return respondOk({ deletionRequest }, requestId, 201);
  } catch (error) {
    return respondError(error, requestId);
  }
}
