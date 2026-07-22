import "server-only";
import { ApiError } from "../api/errors";
import { sendPushToProfile } from "./send-push";
import type { NotificationRow, NotificationsDbClient } from "./types";

const ESCALATION_PUSH_TITLES: Record<string, string> = {
  verified_destroyed_threshold: "Laporan kerusakan parah terverifikasi",
  cluster_destroyed_radius: "Klaster kerusakan parah terdeteksi",
  verifier_sla_breach: "Laporan melewati batas waktu tinjauan",
  task_overdue: "Tugas respons terlambat",
  repeated_duplicate_source: "Sumber laporan duplikat berulang",
  repeated_analysis_failure: "Analisis laporan gagal berulang kali",
};

/**
 * Calls evaluate_escalations() for one organization — the single entry
 * point every trigger site (event-driven, from a domain-service write; or
 * periodic, from a future worker sweep) converges on, so rule logic never
 * drifts between call sites. Returns the count of NEWLY-raised
 * notifications this call produced (0 means every condition that's true
 * right now already has its notification from a prior call — the
 * idempotence this block's acceptance criterion requires).
 *
 * Also fans out a Web Push notification for every row newly inserted by
 * this call (queried by created_at >= the timestamp captured just before
 * the RPC runs, since the RPC itself only returns a count) — push is
 * always a best-effort augmentation of the in-app notification that
 * already exists in the database; a push delivery failure never affects
 * the notification record itself.
 */
export async function evaluateEscalations(db: NotificationsDbClient, organizationId: string): Promise<number> {
  const sinceIso = new Date().toISOString();

  const { data, error } = await db.rpc("evaluate_escalations", { p_organization_id: organizationId }).single<number>();

  if (error) {
    if (error.code === "42501") {
      throw new ApiError("forbidden", "Anda tidak memiliki izin untuk mengevaluasi eskalasi.");
    }
    throw new ApiError("internal_error", "Gagal mengevaluasi aturan eskalasi.");
  }

  const raisedCount = data ?? 0;
  if (raisedCount > 0) {
    await pushNewEscalationNotifications(db, sinceIso);
  }

  return raisedCount;
}

interface RoleAssignmentRow {
  profile_id: string;
  role: string;
}

/** The Notifikasi screen for each role — matches ROLE_NAV_ITEMS' notifikasi hrefs in lib/navigation/nav-items.ts. Admin/Auditor have no dedicated notifikasi screen yet, so their push falls back to their portal home. */
const ROLE_NOTIFIKASI_PATH: Record<string, string> = {
  verifier: "/verifier/notifikasi",
  response_coordinator: "/command/notifikasi",
  reporter: "/reporter",
  system_administrator: "/admin",
  auditor: "/audit",
};

async function pushNewEscalationNotifications(db: NotificationsDbClient, sinceIso: string): Promise<void> {
  const { data: newNotifications } = await db
    .from("notifications")
    .select("*")
    .gte("created_at", sinceIso)
    .not("dedup_key", "is", null)
    .returns<NotificationRow[]>();

  if (!newNotifications || newNotifications.length === 0) return;

  const recipientIds = newNotifications.map((n) => n.recipient_profile_id);
  const { data: roleRows } = await db
    .from("role_assignments")
    .select("profile_id, role")
    .in("profile_id", recipientIds)
    .is("revoked_at", null)
    .returns<RoleAssignmentRow[]>();

  const roleByProfileId = new Map<string, string>();
  for (const row of roleRows ?? []) {
    if (!roleByProfileId.has(row.profile_id)) roleByProfileId.set(row.profile_id, row.role);
  }

  for (const notification of newNotifications) {
    const title = ESCALATION_PUSH_TITLES[notification.type] ?? "Notifikasi eskalasi baru";
    const role = roleByProfileId.get(notification.recipient_profile_id);
    const url = (role && ROLE_NOTIFIKASI_PATH[role]) ?? "/";
    await sendPushToProfile(db, notification.recipient_profile_id, {
      title,
      body: "Buka MBOYO untuk melihat detail.",
      url,
    });
  }
}
