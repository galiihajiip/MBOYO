import "server-only";
import type { NotificationListFilters } from "@mboyo/domain";
import { ApiError } from "../api/errors";
import { toNotificationDto, type NotificationDto, type NotificationRow, type NotificationsDbClient } from "./types";

/**
 * Lists the caller's own notifications, most recent first — RLS
 * (notifications_select_own) is the sole authorization boundary; this
 * function applies no role logic of its own, matching every other list
 * function in this codebase.
 */
export async function listNotifications(
  db: NotificationsDbClient,
  filters: NotificationListFilters,
): Promise<NotificationDto[]> {
  let query = db.from("notifications").select("*");

  if (filters.unreadOnly) {
    query = query.is("read_at", null);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).returns<NotificationRow[]>();

  if (error) {
    throw new ApiError("internal_error", "Gagal memuat notifikasi.");
  }

  return (data ?? []).map(toNotificationDto);
}

export async function countUnreadNotifications(db: NotificationsDbClient): Promise<number> {
  const { count, error } = await db
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .is("read_at", null);

  if (error) {
    throw new ApiError("internal_error", "Gagal memuat jumlah notifikasi belum dibaca.");
  }

  return count ?? 0;
}

/**
 * Marks one notification read via mark_notification_read() (SECURITY
 * INVOKER, relies entirely on notifications_update_own_read_at RLS) —
 * idempotent: re-marking an already-read notification is a harmless
 * no-op, matching the RPC's own coalesce(read_at, now()) behavior.
 */
export async function markNotificationRead(db: NotificationsDbClient, notificationId: string): Promise<NotificationDto> {
  const { data, error } = await db.rpc("mark_notification_read", { p_notification_id: notificationId }).single<NotificationRow>();

  if (error) {
    if (error.code === "P0002") {
      throw new ApiError("not_found", "Notifikasi tidak ditemukan.");
    }
    throw new ApiError("internal_error", "Gagal menandai notifikasi sebagai dibaca.");
  }
  if (!data) {
    throw new ApiError("internal_error", "Gagal menandai notifikasi sebagai dibaca.");
  }

  return toNotificationDto(data);
}
