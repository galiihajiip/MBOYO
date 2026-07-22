import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { requireApiPermission } from "../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../lib/api/respond";
import { resolveRequestId } from "../../../../lib/api/request-id";
import { listAuditEvents } from "../../../../lib/audit/trail";

export const dynamic = "force-dynamic";

/** Filterable audit_events read — Audit Trail. GET-only: this file exports no POST/PUT/PATCH/DELETE, per "Auditor exposes no mutation route." */
export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiPermission("audit_event", "read");
    const supabase = await createServerSupabaseClient();
    const params = request.nextUrl.searchParams;
    const events = await listAuditEvents(supabase, {
      entityType: params.get("entityType") ?? undefined,
      action: params.get("action") ?? undefined,
      actorProfileId: params.get("actorProfileId") ?? undefined,
    });
    return respondOk({ events }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
