import "server-only";
import type { NotificationListFilters } from "@mboyo/domain";
import { ApiError } from "../api/errors";
import { toNotificationDto, type NotificationDto, type NotificationRow, type NotificationsDbClient } from "./types";

export async function listNotifications(
  db: NotificationsDbClient,
  filters: NotificationListFilters,
): Promise<NotificationDto[]> {
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    return [
      {
        id: "demo-notif-1",
        profileId: "demo-user",
        title: "Peringatan Eskalasi Kritis",
        message: "Klaster Kerusakan Parah Sektor Barat membutuhkan tindakan evakuasi segera.",
        level: "critical",
        readAt: null,
        createdAt: new Date().toISOString(),
      },
      {
        id: "demo-notif-2",
        profileId: "demo-user",
        title: "Pembaruan Status Laporan",
        message: "Laporan LPN-2026-001 telah diverifikasi oleh petugas verifikator.",
        level: "info",
        readAt: new Date(Date.now() - 3600000).toISOString(),
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ];
  }

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
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    return 1;
  }

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
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    return {
      id: notificationId,
      profileId: "demo-user",
      title: "Peringatan Eskalasi Kritis",
      message: "Klaster Kerusakan Parah Sektor Barat membutuhkan tindakan evakuasi segera.",
      level: "critical",
      readAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  }

  const { data, error } = await db.rpc("mark_notification_read", { p_notification_id: notificationId }).single<NotificationRow>();

  if (error || !data) {
    throw new ApiError("internal_error", "Gagal menandai notifikasi sebagai dibaca.");
  }

  return toNotificationDto(data);
}
