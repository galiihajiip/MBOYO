import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { requireApiRole } from "../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../lib/api/respond";
import { resolveRequestId } from "../../../../lib/api/request-id";
import {
  getIntegrationUsageSummary,
  getServiceHealthSummary,
  getStorageUsageSummaries,
  getUserActivitySummary,
} from "../../../../lib/admin/analytics";

export const dynamic = "force-dynamic";

/** Admin analytics (BLOCK 26): service health, failures, storage usage, user activity, integration usage. */
export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiRole("system_administrator");
    const supabase = await createServerSupabaseClient();
    const [serviceHealth, storageUsage, userActivity, integrationUsage] = await Promise.all([
      getServiceHealthSummary(supabase),
      getStorageUsageSummaries(supabase),
      getUserActivitySummary(supabase),
      getIntegrationUsageSummary(supabase),
    ]);
    return respondOk({ serviceHealth, storageUsage, userActivity, integrationUsage }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
