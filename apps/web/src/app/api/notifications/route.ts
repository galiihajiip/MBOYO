import type { NextRequest } from "next/server";
import { notificationListFiltersSchema } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { requireApiPermission } from "../../../lib/api/authorize";
import { respondOk, respondError } from "../../../lib/api/respond";
import { resolveRequestId } from "../../../lib/api/request-id";
import { countUnreadNotifications, listNotifications } from "../../../lib/notifications/notifications";

export const dynamic = "force-dynamic";

/** Lists the caller's own notifications (RLS-scoped), optionally unread-only. */
export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiPermission("notification", "read");
    const supabase = await createServerSupabaseClient();
    const filters = notificationListFiltersSchema.parse({
      unreadOnly: request.nextUrl.searchParams.get("unreadOnly") === "true" ? true : undefined,
    });
    const [notifications, unreadCount] = await Promise.all([
      listNotifications(supabase, filters),
      countUnreadNotifications(supabase),
    ]);
    return respondOk({ notifications, unreadCount }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
