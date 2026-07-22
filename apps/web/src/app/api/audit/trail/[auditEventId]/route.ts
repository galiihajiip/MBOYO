import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../../../../lib/supabase/server";
import { requireApiPermission } from "../../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../../lib/api/respond";
import { resolveRequestId } from "../../../../../lib/api/request-id";
import { getAuditEventById } from "../../../../../lib/audit/trail";

export const dynamic = "force-dynamic";

/** One audit event's full detail — GET-only. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ auditEventId: string }> }) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiPermission("audit_event", "read");
    const supabase = await createServerSupabaseClient();
    const { auditEventId } = await params;
    const event = await getAuditEventById(supabase, auditEventId);
    return respondOk({ event }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
