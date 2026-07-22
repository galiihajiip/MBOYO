"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NotificationCard, EmptyState } from "@mboyo/ui";
import { useRealtimeNotifications, type RealtimeNotificationRow } from "./useRealtimeNotifications";

export interface NotificationListItem {
  id: string;
  type: string;
  level: "info" | "warning" | "high" | "critical";
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListProps {
  profileId: string;
  initialNotifications: NotificationListItem[];
  role?: string;
  resolveHref?: (notification: NotificationListItem) => string | null;
}

const TYPE_LABELS: Record<string, string> = {
  verified_destroyed_threshold: "Laporan Kerusakan Parah Terverifikasi",
  cluster_destroyed_radius: "Klaster Kerusakan Parah Terdeteksi",
  verifier_sla_breach: "Laporan Melewati Batas Waktu Tinjauan",
  task_overdue: "Tugas Respons Terlambat",
  repeated_duplicate_source: "Sumber Laporan Duplikat Berulang",
  repeated_analysis_failure: "Analisis Laporan Gagal Berulang Kali",
};

const LEVEL_LABELS: Record<string, string> = {
  info: "Info",
  warning: "Peringatan",
  high: "Tinggi",
  critical: "Kritis",
};

function defaultResolveHref(role: string | undefined, notification: NotificationListItem): string | null {
  if (role === "response_coordinator") {
    const taskId = notification.payload?.taskId;
    if (typeof taskId === "string") return `/command/tugas/${taskId}`;
    return "/command/peta";
  }
  if (role === "verifier") {
    const reportId = notification.payload?.reportId;
    if (typeof reportId === "string") return `/verifier/laporan/${reportId}`;
    return "/verifier/antrean";
  }
  return null;
}

export function NotificationList({ profileId, initialNotifications, role, resolveHref }: NotificationListProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);

  useRealtimeNotifications(profileId, (row: RealtimeNotificationRow) => {
    setNotifications((current) => [
      {
        id: row.id,
        type: row.type,
        level: row.level,
        payload: row.payload,
        readAt: row.read_at,
        createdAt: row.created_at,
      },
      ...current,
    ]);
  });

  async function handleClick(notification: NotificationListItem) {
    if (!notification.readAt) {
      setNotifications((current) =>
        current.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      await fetch(`/api/notifications/${notification.id}/read`, { method: "POST" }).catch(() => {});
    }
    const href = resolveHref ? resolveHref(notification) : defaultResolveHref(role, notification);
    if (href) router.push(href);
  }

  if (notifications.length === 0) {
    return <EmptyState title="Tidak ada notifikasi" description="Notifikasi baru akan muncul di sini secara langsung." />;
  }

  return (
    <ul className="flex flex-col gap-1">
      {notifications.map((notification) => (
        <li key={notification.id}>
          <NotificationCard
            title={TYPE_LABELS[notification.type] ?? notification.type}
            description={`Tingkat: ${LEVEL_LABELS[notification.level] ?? notification.level}`}
            timestamp={new Date(notification.createdAt).toLocaleString("id-ID")}
            read={notification.readAt !== null}
            onClick={() => void handleClick(notification)}
          />
        </li>
      ))}
    </ul>
  );
}
