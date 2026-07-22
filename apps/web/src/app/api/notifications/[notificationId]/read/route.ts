import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../../../../lib/supabase/server";
import { requireApiPermission } from "../../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../../lib/api/respond";
import { resolveRequestId } from "../../../../../lib/api/request-id";
import { markNotificationRead } from "../../../../../lib/notifications/notifications";

export const dynamic = "force-dynamic";

/** Marks one of the caller's own notifications read — idempotent. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ notificationId: string }> }) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiPermission("notification", "read");
    const supabase = await createServerSupabaseClient();
    const { notificationId } = await params;
    const notification = await markNotificationRead(supabase, notificationId);
    return respondOk({ notification }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
