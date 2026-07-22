import type { NextRequest } from "next/server";
import { placeLegalHoldSchema } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../../../lib/supabase/server";
import { requireApiPermission } from "../../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../../lib/api/respond";
import { resolveRequestId } from "../../../../../lib/api/request-id";
import { listLegalHolds, placeLegalHold } from "../../../../../lib/admin/retention";

export const dynamic = "force-dynamic";

/** Lists legal_holds — Admin/Auditor visibility. */
export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiPermission("legal_hold", "read");
    const supabase = await createServerSupabaseClient();
    const holds = await listLegalHolds(supabase);
    return respondOk({ holds }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}

/** Places a legal hold on a report or disaster_event — Admin-only, always audited. */
export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiPermission("legal_hold", "create");
    const supabase = await createServerSupabaseClient();
    const body: unknown = await request.json().catch(() => null);
    const input = placeLegalHoldSchema.parse(body);
    const hold = await placeLegalHold(supabase, input);
    return respondOk({ hold }, requestId, 201);
  } catch (error) {
    return respondError(error, requestId);
  }
}
