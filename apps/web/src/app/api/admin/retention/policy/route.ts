import type { NextRequest } from "next/server";
import { z } from "zod";
import { retentionPolicySchema } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../../../lib/supabase/server";
import { requireApiActor, requireApiPermission } from "../../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../../lib/api/respond";
import { resolveRequestId } from "../../../../../lib/api/request-id";
import { listRetentionPolicies, updateRetentionPolicy } from "../../../../../lib/admin/retention";

export const dynamic = "force-dynamic";

const updatePolicyBodySchema = z.object({ key: z.string().min(1), value: retentionPolicySchema });

/** Lists the org's declared retention.* policy rows — system_settings_select_any_authenticated already lets any authenticated profile read these. */
export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    const actor = await requireApiActor();
    const supabase = await createServerSupabaseClient();
    const policies = await listRetentionPolicies(supabase, actor.organizationId);
    return respondOk({ policies }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}

/** Updates one retention.* policy row's declared value — Admin-only, audited unconditionally by system_settings_audit_trigger. */
export async function POST(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    const actor = await requireApiPermission("system_setting", "configure");
    const supabase = await createServerSupabaseClient();
    const body: unknown = await request.json().catch(() => null);
    const input = updatePolicyBodySchema.parse(body);
    const policy = await updateRetentionPolicy(supabase, actor.organizationId, actor.profileId, input.key, input.value);
    return respondOk({ policy }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
