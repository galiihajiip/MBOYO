import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { requireApiPermission } from "../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../lib/api/respond";
import { resolveRequestId } from "../../../../lib/api/request-id";
import { getModelUsageSummary, listModelEvaluations, listModelRegistryEntries } from "../../../../lib/audit/model-registry";

export const dynamic = "force-dynamic";

/** Model registry history, evaluation gates, and usage counts — Auditor's model oversight. */
export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiPermission("model_registry_entry", "read");
    const supabase = await createServerSupabaseClient();
    const [entries, evaluations, usage] = await Promise.all([
      listModelRegistryEntries(supabase),
      listModelEvaluations(supabase),
      getModelUsageSummary(supabase),
    ]);
    return respondOk({ entries, evaluations, usage }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
