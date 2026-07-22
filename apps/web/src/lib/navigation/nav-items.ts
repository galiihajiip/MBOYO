import type { Role } from "@mboyo/domain";

export interface NavItem {
  label: string;
  href: string;
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
    { label: "Analitik", href: "/verifier/analitik", icon: "analytics" },
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
    { label: "Kejadian Bencana", href: "/admin/event", icon: "event" },
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

export const MOBILE_BOTTOM_BAR_COUNT = 4;
