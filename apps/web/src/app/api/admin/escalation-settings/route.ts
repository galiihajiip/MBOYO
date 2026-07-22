import type { NextRequest } from "next/server";
import { updateEscalationSettingSchema } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { requireApiRole } from "../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../lib/api/respond";
import { resolveRequestId } from "../../../../lib/api/request-id";
import { listEscalationSettings, updateEscalationSetting } from "../../../../lib/notifications/escalation-settings";

export const dynamic = "force-dynamic";

/** Lists every escalation.* system_settings row for the caller's own organization — Aturan Eskalasi. Read access matches system_settings_select_any_authenticated (any authenticated role), but this screen is Admin-only per navigation, so the route still requires system_administrator. */
export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    const actor = await requireApiRole("system_administrator");
    const supabase = await createServerSupabaseClient();
    const settings = await listEscalationSettings(supabase, actor.organizationId);
    return respondOk({ settings }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}

/** Updates one escalation rule's settings — system_settings_admin_all RLS enforces write access; validated per-rule against escalationSettingSchemas first. */
export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    const actor = await requireApiRole("system_administrator");
    const supabase = await createServerSupabaseClient();
    const body: unknown = await request.json().catch(() => null);
    const input = updateEscalationSettingSchema.parse(body);
    const setting = await updateEscalationSetting(supabase, actor.organizationId, actor.profileId, input.ruleType, input.value);
    return respondOk({ setting }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
