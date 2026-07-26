import "server-only";
import type { NotificationListFilters } from "@mboyo/domain";
import { ApiError } from "../api/errors";
import { toNotificationDto, type NotificationDto, type NotificationRow, type NotificationsDbClient } from "./types";

export async function listNotifications(
  db: NotificationsDbClient,
  filters: NotificationListFilters,
): Promise<NotificationDto[]> {
  try {
    let query = db.from("notifications").select("*");
    if (filters.unreadOnly) {
      query = query.is("read_at", null);
    }

    const { data, error } = await query.order("created_at", { ascending: false }).returns<NotificationRow[]>();
    if (!error && data) {
      return data.map(toNotificationDto);
    }
  } catch {}

  throw new ApiError("internal_error", "Gagal memuat notifikasi.");
}

export async function countUnreadNotifications(db: NotificationsDbClient): Promise<number> {
  try {
    const { count, error } = await db
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .is("read_at", null);

    if (!error && count !== null) {
      return count;
    }
  } catch {}

  throw new ApiError("internal_error", "Gagal memuat jumlah notifikasi belum dibaca.");
}

export async function markNotificationRead(db: NotificationsDbClient, notificationId: string): Promise<NotificationDto> {
  const { data, error } = await db.rpc("mark_notification_read", { p_notification_id: notificationId }).single<NotificationRow>();

  if (error || !data) {
    throw new ApiError("internal_error", "Gagal menandai notifikasi sebagai dibaca.");
  }

  return toNotificationDto(data);
}
