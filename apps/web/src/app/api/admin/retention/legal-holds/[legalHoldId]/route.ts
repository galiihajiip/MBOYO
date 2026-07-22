import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../../../../../lib/supabase/server";
import { requireApiPermission } from "../../../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../../../lib/api/respond";
import { resolveRequestId } from "../../../../../../lib/api/request-id";
import { releaseLegalHold } from "../../../../../../lib/admin/retention";

export const dynamic = "force-dynamic";

/** Releases an active legal hold — Admin-only, always audited. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ legalHoldId: string }> }) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiPermission("legal_hold", "update");
    const supabase = await createServerSupabaseClient();
    const { legalHoldId } = await params;
    const hold = await releaseLegalHold(supabase, legalHoldId);
    return respondOk({ hold }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
