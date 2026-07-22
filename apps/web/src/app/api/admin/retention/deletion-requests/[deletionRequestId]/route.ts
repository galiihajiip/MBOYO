import type { NextRequest } from "next/server";
import { reviewDeletionRequestSchema } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../../../../lib/supabase/server";
import { requireApiPermission } from "../../../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../../../lib/api/respond";
import { resolveRequestId } from "../../../../../../lib/api/request-id";
import { reviewDeletionRequest } from "../../../../../../lib/admin/retention";

export const dynamic = "force-dynamic";

/** Reviews (approves/denies/marks completed) a deletion request — Admin-only, always audited. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ deletionRequestId: string }> }) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiPermission("deletion_request", "update");
    const supabase = await createServerSupabaseClient();
    const { deletionRequestId } = await params;
    const body: unknown = await request.json().catch(() => null);
    const input = reviewDeletionRequestSchema.parse(body);
    const deletionRequest = await reviewDeletionRequest(supabase, deletionRequestId, input);
    return respondOk({ deletionRequest }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
