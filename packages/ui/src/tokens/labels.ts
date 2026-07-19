/**
 * Bahasa Indonesia label tokens — mirrors docs/product/CONTENT_GUIDE.md
 * severity/priority/report-status/task-status tables exactly. Components
 * must resolve display labels through these maps, never inline strings,
 * so terminology stays consistent with the content guide everywhere.
 */

export const severityLabels = {
  unknown: "Tidak Diketahui",
  no_damage: "Tidak Ada Kerusakan",
  minor_damage: "Kerusakan Ringan",
  major_damage: "Kerusakan Berat",
  destroyed: "Hancur Total",
} as const;

export const priorityLabels = {
  unassigned: "Belum Ditentukan",
  low: "Rendah",
  medium: "Sedang",
  high: "Tinggi",
  critical: "Kritis",
} as const;

/** Reporter-facing report status labels (simplified) per CONTENT_GUIDE.md. */
export const reportStatusLabelsReporter = {
  draft_local: "Draf tersimpan di perangkat",
  queued_offline: "Menunggu koneksi untuk sinkronisasi",
  syncing: "Sedang menyinkronkan...",
  submitted: "Laporan terkirim",
  evidence_uploaded: "Laporan terkirim",
  analysis_queued: "Sedang diproses",
  analysis_running: "Sedang diproses",
  analysis_completed: "Sedang ditinjau",
  needs_manual_review: "Sedang ditinjau",
  verified: "Terverifikasi",
  rejected: "Ditolak",
  archived: "Diarsipkan",
} as const;

/** Verifier/Coordinator/Auditor-facing report status labels (full detail). */
export const reportStatusLabelsInternal = {
  draft_local: "Draf lokal",
  queued_offline: "Antrean offline",
  syncing: "Sinkronisasi berlangsung",
  submitted: "Terkirim",
  evidence_uploaded: "Bukti terunggah",
  analysis_queued: "Menunggu analisis",
  analysis_running: "Analisis berlangsung",
  analysis_completed: "Analisis selesai",
  needs_manual_review: "Perlu tinjauan manual",
  verified: "Terverifikasi",
  rejected: "Ditolak",
  archived: "Diarsipkan",
} as const;

export const taskStatusLabels = {
  draft: "Draf",
  assigned: "Ditugaskan",
  acknowledged: "Dikonfirmasi",
  in_progress: "Sedang Berjalan",
  blocked: "Terkendala",
  completed: "Selesai",
  cancelled: "Dibatalkan",
} as const;

export const verificationDecisionLabels = {
  confirm: "Konfirmasi",
  override: "Ganti Klasifikasi",
  reject: "Tolak",
  request_info: "Minta Informasi",
  escalate: "Eskalasi",
  insufficient_evidence: "Bukti Tidak Cukup",
} as const;

/** Past-tense/status label per CONTENT_GUIDE.md's "Verification Decision Labels" table — used in the review-history Timeline, distinct from the button label above. */
export const verificationDecisionStatusLabels = {
  confirm: "Dikonfirmasi",
  override: "Klasifikasi Diubah",
  reject: "Ditolak",
  request_info: "Menunggu Informasi Tambahan",
  escalate: "Dieskalasi",
  insufficient_evidence: "Menunggu Bukti Tambahan",
} as const;

/** Mirrors CONTENT_GUIDE.md's "Reject Reason Categories" table (BLOCK 23). */
export const rejectReasonLabels = {
  insufficient_evidence: "Bukti tidak cukup",
  not_disaster_related: "Tidak terkait bencana",
  duplicate_report: "Laporan duplikat",
  fraudulent_or_spam: "Diduga palsu/spam",
  outside_event_boundary: "Di luar batas wilayah kejadian",
  other: "Lainnya",
} as const;

export const roleLabels = {
  reporter: "Pelapor",
  verifier: "Verifikator",
  response_coordinator: "Koordinator Respons",
  system_administrator: "Administrator Sistem",
  auditor: "Auditor",
} as const;

/** Mandatory disclosure strings per AGENTS.md / CONTENT_GUIDE.md — never paraphrase these. */
export const disclosureLabels = {
  demoModeActive: "Mode Demo Aktif — koneksi disimulasikan",
  advisoryOnly:
    "Belum lolos ambang evaluasi — gunakan sebagai referensi, bukan keputusan",
  geminiAdvisory:
    "Saran AI (Gemini) — hanya referensi tambahan, bukan keputusan verifikator",
} as const;
