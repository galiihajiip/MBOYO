import type { Role } from "@mboyo/domain";

export interface NavItem {
  label: string;
  href: string;
  /** Icon key resolved by components/shell/NavIcon.tsx — kept as a string key
   * (not a component reference) so this file stays a plain data module with
   * no React import, safe to use from both server and client code. */
  icon: NavIconKey;
}

export type NavIconKey =
  | "home"
  | "report-plus"
  | "inbox"
  | "list"
  | "help"
  | "user"
  | "summary"
  | "queue"
  | "map"
  | "info-request"
  | "bell"
  | "command"
  | "crisis-map"
  | "priority"
  | "task"
  | "analytics"
  | "export"
  | "admin"
  | "users"
  | "event"
  | "escalation"
  | "integration"
  | "health"
  | "settings"
  | "audit-trail"
  | "read-only"
  | "model-registry"
  | "model-eval"
  | "compliance"
  | "retention";

/**
 * Per-role navigation, transcribed exactly from
 * docs/product/NAVIGATION_BY_ROLE.md — same item count, same order, same
 * Bahasa Indonesia labels. This is the single source every shell (desktop
 * sidebar, tablet collapsed rail, mobile bottom bar + overflow sheet) reads
 * from, so no surface can silently drift from what that document specifies.
 */
export const ROLE_NAV_ITEMS: Record<Role, NavItem[]> = {
  reporter: [
    { label: "Beranda", href: "/reporter", icon: "home" },
    { label: "Buat Laporan", href: "/reporter/laporan/baru", icon: "report-plus" },
    { label: "Antrean Offline", href: "/reporter/antrean", icon: "inbox" },
    { label: "Laporan Saya", href: "/reporter/laporan", icon: "list" },
    { label: "Bantuan", href: "/reporter/bantuan", icon: "help" },
    { label: "Profil", href: "/reporter/profil", icon: "user" },
  ],
  verifier: [
    { label: "Ringkasan", href: "/verifier", icon: "summary" },
    { label: "Antrean Verifikasi", href: "/verifier/antrean", icon: "queue" },
    { label: "Peta Bukti", href: "/verifier/peta", icon: "map" },
    { label: "Semua Laporan", href: "/verifier/laporan", icon: "list" },
    { label: "Permintaan Informasi", href: "/verifier/permintaan-informasi", icon: "info-request" },
    { label: "Notifikasi", href: "/verifier/notifikasi", icon: "bell" },
    { label: "Profil", href: "/verifier/profil", icon: "user" },
  ],
  response_coordinator: [
    { label: "Command Center", href: "/command", icon: "command" },
    { label: "Peta Krisis", href: "/command/peta", icon: "crisis-map" },
    { label: "Prioritas", href: "/command/prioritas", icon: "priority" },
    { label: "Tugas Respons", href: "/command/tugas", icon: "task" },
    { label: "Analitik", href: "/command/analitik", icon: "analytics" },
    { label: "Ekspor", href: "/command/ekspor", icon: "export" },
    { label: "Notifikasi", href: "/command/notifikasi", icon: "bell" },
    { label: "Profil", href: "/command/profil", icon: "user" },
  ],
  system_administrator: [
    { label: "Administrasi", href: "/admin", icon: "admin" },
    { label: "Pengguna & Role", href: "/admin/pengguna", icon: "users" },
    { label: "Event Bencana", href: "/admin/event", icon: "event" },
    { label: "Aturan Eskalasi", href: "/admin/eskalasi", icon: "escalation" },
    { label: "Integrasi", href: "/admin/integrasi", icon: "integration" },
    { label: "Kesehatan Sistem", href: "/admin/kesehatan", icon: "health" },
    { label: "Pengaturan", href: "/admin/pengaturan", icon: "settings" },
    { label: "Profil", href: "/admin/profil", icon: "user" },
  ],
  auditor: [
    { label: "Audit Trail", href: "/audit", icon: "audit-trail" },
    { label: "Laporan Read-Only", href: "/audit/laporan", icon: "read-only" },
    { label: "Model Registry", href: "/audit/model-registry", icon: "model-registry" },
    { label: "Evaluasi Model", href: "/audit/evaluasi-model", icon: "model-eval" },
    { label: "Export Compliance", href: "/audit/ekspor-kepatuhan", icon: "compliance" },
    { label: "Retensi Data", href: "/audit/retensi-data", icon: "retention" },
    { label: "Profil", href: "/audit/profil", icon: "user" },
  ],
};

/**
 * Mobile bottom-tab-bar item count per role, per
 * docs/product/INFORMATION_ARCHITECTURE.md's responsive rule: "bottom tab
 * bar for the 4-5 most-used items + 'More' overflow sheet for the rest."
 * The first N items of ROLE_NAV_ITEMS[role] are the bottom-bar items; the
 * remainder go in the overflow sheet. Profil is always last and always
 * overflows except for roles with <= this count total items.
 */
export const MOBILE_BOTTOM_BAR_COUNT = 4;
