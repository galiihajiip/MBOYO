import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { requireApiPermission } from "../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../lib/api/respond";
import { resolveRequestId } from "../../../../lib/api/request-id";
import { listUsersWithRoles } from "../../../../lib/admin/users";

export const dynamic = "force-dynamic";

/** Lists every profile in the org with their current active roles — Pengguna & Role. */
export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiPermission("profile", "read");
    const supabase = await createServerSupabaseClient();
    const users = await listUsersWithRoles(supabase);
    return respondOk({ users }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
