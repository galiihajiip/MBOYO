import type { Metadata } from "next";
import { getCurrentUser } from "../../../lib/auth/server";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { listNotifications } from "../../../lib/notifications/notifications";
import { NotificationList, type NotificationListItem } from "../../../components/notifications/NotificationList";
import { PushOptIn } from "../../../components/notifications/PushOptIn";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notifikasi — MBOYO" };

/** Coordinator's Notifikasi screen (BLOCK 25) — replacing the earlier stub. Escalation types relevant to Coordinator: verified_destroyed_threshold, cluster_destroyed_radius, task_overdue. */
export default async function CommandNotifikasiPage() {
  const user = await getCurrentUser();
  const supabase = await createServerSupabaseClient();
  const notifications = await listNotifications(supabase, {});

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-sans text-2xl font-bold text-on-surface">Notifikasi</h1>
      <PushOptIn />
      <NotificationList
        profileId={user?.profileId ?? ""}
        initialNotifications={notifications}
        resolveHref={resolveCommandNotificationHref}
      />
    </div>
  );
}

function resolveCommandNotificationHref(notification: NotificationListItem): string | null {
  const taskId = notification.payload.taskId;
  if (typeof taskId === "string") {
    return `/command/tugas/${taskId}`;
  }
  const seedReportId = notification.payload.seedReportId ?? notification.payload.reportId;
  if (typeof seedReportId === "string") {
    return `/command/peta`;
  }
  return "/command";
}
