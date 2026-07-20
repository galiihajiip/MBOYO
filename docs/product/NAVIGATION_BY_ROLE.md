# MBOYO Navigation by Role

Navigation structure for each of the five role UIs, in Bahasa Indonesia per [AGENTS.md](../../AGENTS.md) user-facing copy rule. Each item lists its primary entities (from [DOMAIN_MODEL.md](DOMAIN_MODEL.md)) and the RBAC actions available there (from [RBAC_MATRIX.md](RBAC_MATRIX.md)), so navigation structure and access control stay provably in sync — a nav item must never expose an action the matrix forbids for that role.

## Reporter

| Item | Purpose | Entities | Actions available here |
|---|---|---|---|
| **Beranda** | Landing/status overview: connectivity state, pending sync count, quick-start to new report. | `report` (own, summary) | R (own) |
| **Buat Laporan** | Report creation: photo capture/select, GPS capture, description — the offline-capable entry point to the [MVP live flow](PRODUCT_CHARTER.md#the-mvp-live-flow). | `report`, `report_evidence`, `geolocation_observation` | C (own) |
| **Antrean Offline** | Local queue view: reports saved locally, sync status (`draft_local`/`queued_offline`/`syncing`), retry visibility. | `report` (local/own, pre-sync states) | R (own) |
| **Laporan Saya** | History of all own reports across their full lifecycle, including post-verification status (without exposing Verifier/Coordinator-only detail). | `report` (own, all states) | R (own) |
| **Bantuan** | Static help content, offline capture tips (e.g., photo quality guidance per [RISK_REGISTER.md](RISK_REGISTER.md) risk #4). | — (static content) | — |
| **Profil** | Own account/profile management. | `profile` (own) | R/U (own) |

## Verifier

| Item | Purpose | Entities | Actions available here |
|---|---|---|---|
| **Ringkasan** | Dashboard summary: queue depth, SLA status, recent decisions. | `report`, `verification_review` (aggregate) | R |
| **Antrean Verifikasi** | Primary work queue: reports in `analysis_completed`/`needs_manual_review`, ready for review. | `report`, `model_prediction`, `model_explanation`, `geolocation_observation`, `report_evidence` | R (all); C on `verification_review` (the confirm/override/reject/request-info/escalate actions live here) |
| **Peta Bukti** | Map view of incoming evidence by location, to spot spatial patterns (clustering, geofence mismatches) ahead of/alongside per-report review. | `report`, `geolocation_observation` | R |
| **Semua Laporan** | Full report list across all statuses (not just the active queue), for lookup/reference. | `report` (all) | R |
| **Permintaan Informasi** | Tracks reports where the Verifier chose "request info" — follow-up state pending Reporter response. | `report`, `verification_review` | R; C (new request-info decision) |
| **Notifikasi** | Own notifications (new items in queue, Reporter responses to info requests). | `notification` (own) | R (own) |
| **Profil** | Own account/profile management. | `profile` (own) | R/U (own) |

## Response Coordinator

| Item | Purpose | Entities | Actions available here |
|---|---|---|---|
| **Command Center** | Primary operational dashboard: verified/escalated incidents needing attention, active task summary. | `report` (verified/escalated), `response_task` | R |
| **Peta Krisis** | MapLibre map of verified incidents, with the non-map list/table fallback per [DEPLOYMENT_TOPOLOGY.md](../architecture/DEPLOYMENT_TOPOLOGY.md) resilience note. | `report` (verified), `incident_cluster` | R; C/U on `incident_cluster` (grouping) |
| **Prioritas** | Priority-setting workflow across incidents/clusters/tasks. | `response_task`, `incident_cluster` | U (priority field) |
| **Tugas Respons** | Task management: create, assign, track status through the [task state machine](STATE_MACHINES.md#task-state-machine). | `response_task`, `task_assignment` | C/R/U, As |
| **Analitik** | Recharts dashboard: counts by severity/status/region (Enhanced Demo tier per [MVP_SCOPE.md](MVP_SCOPE.md)). | `report`, `response_task` (aggregate) | R |
| **Ekspor** | Initiate and retrieve data exports (CSV/GeoJSON) for a selected event. | `export_job` | C/R (own) |
| **Notifikasi** | Own notifications (new verified incidents, task updates). | `notification` (own) | R (own) |
| **Profil** | Own account/profile management. | `profile` (own) | R/U (own) |

## System Administrator

| Item | Purpose | Entities | Actions available here |
|---|---|---|---|
| **Administrasi** | Organization-level overview: org settings, event summary. | `organization`, `disaster_event` | R/U/Co |
| **Pengguna & Role** | User and role-assignment management — the only place `role_assignment` is mutated. | `profile`, `role_assignment` | C/R/U/D |
| **Event Bencana** | Create/manage `disaster_event` records, including geofence configuration. | `disaster_event` | C/R/U/Co |
| **Aturan Eskalasi** | Configure escalation thresholds/rules (e.g., quality/confidence thresholds that trigger `needs_manual_review`). | `system_setting` | C/R/U/Co |
| **Integrasi** | Configure optional integrations (e.g., Gemini advisory toggle per [ADR 0004](../adr/0004-local-ml-primary-gemini-advisory.md), push notification provider). | `system_setting` | C/R/U/Co |
| **Kesehatan Sistem** | Service health monitoring: `analysis_job` queue depth/status, model registry state — read-only operational visibility, not a validation or dispatch surface. | `analysis_job` (status only), `model_registry_entry` | R; A (model promotion only, per [SUCCESS_METRICS.md](SUCCESS_METRICS.md) release gate) |
| **Pengaturan** | General configuration: retention policy, thresholds. | `system_setting` | C/R/U/Co |
| **Profil** | Own account/profile management. | `profile` (own) | R/U (own) |

Note: System Administrator's navigation contains no item exposing `report` validation actions or `response_task`/`task_assignment` mutation, consistent with the acceptance criterion that Admin cannot validate or dispatch by default — "Kesehatan Sistem" exposes `analysis_job` and `model_registry_entry` strictly as operational/status read plus model-promotion approval, never a path to `verification_review` or `response_task` creation.

## Auditor

| Item | Purpose | Entities | Actions available here |
|---|---|---|---|
| **Audit Trail** | Full, unfiltered lineage view: report → analysis → verification → dispatch, per entity or globally. | `audit_event` (full) | R (read-only) |
| **Laporan Read-Only** | Browse all reports and their full detail (evidence, predictions, reviews) without any action affordances. | `report`, `report_evidence`, `geolocation_observation`, `model_prediction`, `model_explanation`, `verification_review` | R (read-only) |
| **Model Registry** | View model version history and promotion history. | `model_registry_entry` | R (read-only) |
| **Evaluasi Model** | View evaluation reports backing each model version (macro-F1, destroyed recall, calibration error, dataset identity). | `model_evaluation` | R (read-only) |
| **Export Compliance** | Generate/download compliance-oriented exports and view history of all `export_job` records across the org (not just their own, unlike Coordinator's scoped view). | `export_job` | R, E (read-only, compliance-format export) |
| **Retensi Data** | View retention policy configuration and evidence lifecycle status (what's scheduled for archival/deletion and when) — visibility only, no ability to change policy (that's System Administrator's "Pengaturan"). | `system_setting` (retention subset), `report` (archival status) | R (read-only) |
| **Profil** | Own account/profile management. | `profile` (own) | R/U (own) |

Note: every single item in the Auditor's navigation is read-only, including "Export Compliance" — the export action packages and retrieves existing data without creating, approving, or mutating any underlying record, consistent with the acceptance criterion that Auditor is strictly read-only.

## Cross-Cutting Navigation Rules

- No navigation item appears for a role unless every action reachable from it is permitted in [RBAC_MATRIX.md](RBAC_MATRIX.md) — navigation is a rendering of the matrix, not an independent source of authorization. Server-side/RLS checks remain the actual enforcement layer per [AGENTS.md](../../AGENTS.md); navigation visibility is UX convenience only.
- "Profil" is the one item common to all five roles and is scoped to the user's own `profile` record in every case — this is the intentional self-service overlap noted in [RBAC_MATRIX.md](RBAC_MATRIX.md) acceptance criteria, not a role-boundary violation.
- Where two roles' navigation items reference the same entity (e.g., Verifier's "Antrean Verifikasi" and Coordinator's "Peta Krisis" both touch `report`), the permitted action set differs per the matrix — Verifier can create `verification_review`, Coordinator can only read verified reports and act on `incident_cluster`/`response_task` instead.
