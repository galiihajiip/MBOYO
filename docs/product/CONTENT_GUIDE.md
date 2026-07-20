# MBOYO Content Guide

This document governs all user-facing copy across the screens in [SCREEN_INVENTORY.md](SCREEN_INVENTORY.md), per the Bahasa Indonesia requirement in [AGENTS.md](../../AGENTS.md). It exists so that Google Stitch designs and later implementation use consistent terminology, tone, and formatting rather than each screen inventing its own phrasing.

## Language and Tone

- All user-facing copy is written in Bahasa Indonesia — labels, buttons, error messages, empty states, notifications, emails. Code identifiers, route names, and internal documentation remain in English.
- Tone is calm, direct, and respectful of the emergency context — MBOYO is used during disasters. Avoid alarmist language, avoid overly casual/playful copy, avoid corporate jargon.
- Use active voice and imperative mood for calls to action ("Buat Laporan," not "Laporan dapat dibuat").
- Avoid English loanwords where a natural Indonesian term exists (e.g., prefer "kirim" over "submit," "peta" over "map"), but keep widely understood technical/product terms as-is where translating would reduce clarity (e.g., "GPS," "PWA," "offline" are acceptable as commonly understood terms).

## Canonical Terminology

Use these terms consistently across every screen — do not introduce synonyms for the same concept.

| Concept | Canonical Bahasa Indonesia term | Notes |
|---|---|---|
| Report (entity) | Laporan | Never "insiden" for the Reporter-facing term; "insiden" is reserved for a *verified* report from the Coordinator's perspective. |
| Incident (verified report, Coordinator's view) | Insiden | Only used once a report reaches `verified` status. |
| Report creation flow | Buat Laporan | Exact nav label per [NAVIGATION_BY_ROLE.md](NAVIGATION_BY_ROLE.md). |
| Offline queue | Antrean Offline / Antrean | "Antrean" alone is acceptable in-context once "Antrean Offline" has been established on a given screen. |
| Sync | Sinkronisasi / sinkronkan (verb) | "Sync" as a loanword is acceptable in secondary/help text but primary UI uses "sinkronisasi." |
| Evidence (photo) | Bukti | Not "foto" alone in formal contexts — "bukti" carries the evidentiary meaning; "foto" is fine in casual capture-flow copy ("Ambil Foto"). |
| Verification | Verifikasi | |
| Verifier (role) | Verifikator | |
| Response Coordinator (role) | Koordinator Respons | Shortened to "Koordinator" in-context once established. |
| System Administrator (role) | Administrator Sistem | Shortened to "Admin" in nav/UI labels per [NAVIGATION_BY_ROLE.md](NAVIGATION_BY_ROLE.md) ("Administrasi"). |
| Auditor (role) | Auditor | Same in Indonesian and English; no translation needed. |
| Reporter (role) | Pelapor | |
| Severity | Tingkat Keparahan | Used for the `unknown`/`no_damage`/`minor_damage`/`major_damage`/`destroyed` classification. |
| Priority | Prioritas | Used for `unassigned`/`low`/`medium`/`high`/`critical`. |
| Response task | Tugas Respons | |
| Confidence (model/location) | Tingkat Keyakinan | E.g., "Tingkat Keyakinan Lokasi" (location confidence). |
| Escalate/Escalation | Eskalasi / eskalasikan (verb) | |
| Dispatch (task assignment) | Penugasan / tugaskan (verb) | Avoid "dispatch" as a loanword in user-facing copy. |
| Audit trail | Jejak Audit | |
| Retention (data) | Retensi Data | |
| Export | Ekspor | |

## Severity Labels (Bahasa Indonesia)

Mapped 1:1 to the severity enum in [DOMAIN_MODEL.md](DOMAIN_MODEL.md) `model_prediction.severity_probabilities` and the brand's severity color tokens — label and color must always appear together, never color alone (accessibility) and never label alone where color-coding is the established pattern on a screen.

| Enum value | Label (Bahasa Indonesia) | Color token |
|---|---|---|
| `unknown` | Tidak Diketahui | `#64748B` (Muted) |
| `no_damage` | Tidak Ada Kerusakan | `#2EAD68` (Safe Green) |
| `minor_damage` | Kerusakan Ringan | `#F6B73C` (Caution Amber) |
| `major_damage` | Kerusakan Berat | `#F47A38` (Priority Orange) |
| `destroyed` | Hancur Total | `#D83A3A` (Critical Red) |

## Priority Labels (Bahasa Indonesia)

| Enum value | Label (Bahasa Indonesia) | Color guidance |
|---|---|---|
| `unassigned` | Belum Ditentukan | Muted/neutral, no color emphasis. |
| `low` | Rendah | Safe Green family. |
| `medium` | Sedang | Caution Amber family. |
| `high` | Tinggi | Priority Orange family. |
| `critical` | Kritis | Critical Red — must always carry the strongest visual weight on any screen showing mixed priorities. |

## Report Status Labels (Bahasa Indonesia)

Mapped to the [report state machine](STATE_MACHINES.md#report-state-machine) — Reporter-facing labels are simplified/friendlier than the full internal state name, since a Reporter should never see raw enum values like `analysis_running`.

| State | Reporter-facing label | Verifier/Coordinator/Auditor-facing label |
|---|---|---|
| `draft_local` | Draf tersimpan di perangkat | Draf lokal |
| `queued_offline` | Menunggu koneksi untuk sinkronisasi | Antrean offline |
| `syncing` | Sedang menyinkronkan... | Sinkronisasi berlangsung |
| `submitted` | Laporan terkirim | Terkirim |
| `evidence_uploaded` | Laporan terkirim | Bukti terunggah |
| `analysis_queued` | Sedang diproses | Menunggu analisis |
| `analysis_running` | Sedang diproses | Analisis berlangsung |
| `analysis_completed` | Sedang ditinjau | Analisis selesai |
| `needs_manual_review` | Sedang ditinjau | Perlu tinjauan manual |
| `verified` | Terverifikasi | Terverifikasi |
| `rejected` | Ditolak | Ditolak |
| `archived` | Diarsipkan | Diarsipkan |

Reporter-facing labels deliberately collapse several internal states into "Sedang diproses" / "Sedang ditinjau" — the Reporter does not need to distinguish `analysis_queued` from `analysis_running`, per the RBAC boundary that Reporters have no visibility into `analysis_job`/`model_prediction` detail.

## Task Status Labels (Bahasa Indonesia)

Mapped to the [task state machine](STATE_MACHINES.md#task-state-machine).

| State | Label (Bahasa Indonesia) |
|---|---|
| `draft` | Draf |
| `assigned` | Ditugaskan |
| `acknowledged` | Dikonfirmasi |
| `in_progress` | Sedang Berjalan |
| `blocked` | Terkendala |
| `completed` | Selesai |
| `cancelled` | Dibatalkan |

## Verification Decision Labels

Mapped to `verification_review.decision` in [DOMAIN_MODEL.md](DOMAIN_MODEL.md), matching the button labels already specified in [SCREEN_INVENTORY.md](SCREEN_INVENTORY.md) Antrean Verifikasi — Detail:

| Decision | Button label | Past-tense/status label |
|---|---|---|
| `confirm` | Konfirmasi | Dikonfirmasi |
| `override` | Ganti Klasifikasi | Klasifikasi Diubah |
| `reject` | Tolak | Ditolak |
| `request_info` | Minta Informasi | Menunggu Informasi Tambahan |
| `escalate` | Eskalasi | Dieskalasi |
| `insufficient_evidence` (BLOCK 23) | Bukti Tidak Cukup | Menunggu Bukti Tambahan |

### Reject Reason Categories (`verification_review.reject_reason_category`, BLOCK 23)

| Category | Label |
|---|---|
| `insufficient_evidence` | Bukti tidak cukup |
| `not_disaster_related` | Tidak terkait bencana |
| `duplicate_report` | Laporan duplikat |
| `fraudulent_or_spam` | Diduga palsu/spam |
| `outside_event_boundary` | Di luar batas wilayah kejadian |
| `other` | Lainnya |

## Demo Mode and Advisory Labeling (Mandatory Copy)

Per [AGENTS.md](../../AGENTS.md) demo fallback disclosure requirements and [SUCCESS_METRICS.md](../product/SUCCESS_METRICS.md) advisory-only fallback, the following labels are mandatory wherever their triggering condition applies — no screen may substitute its own wording for these two specific disclosures:

- **Demo mode active (offline/reconnect simulated):** "Mode Demo Aktif — koneksi disimulasikan" (Demo mode active — connection simulated), shown as a persistent, visually distinct badge (not a dismissible toast) for the duration `DEMO_MODE` is engaged.
- **Advisory-only model output (release gate not passed):** "Belum lolos ambang evaluasi — gunakan sebagai referensi, bukan keputusan" (has not passed the evaluation threshold — use as reference, not decision), shown directly adjacent to the affected `model_prediction` probabilities wherever they're displayed (Verifier's Antrean Verifikasi and its detail screen).
- **Gemini advisory output (when enabled):** Always prefaced with "Analisis Tambahan Eksternal — Tidak Menentukan Keputusan Resmi" (External supplementary analysis — does not determine the official decision), rendered verbatim via `GEMINI_ADVISORY_UI_LABEL` (`packages/domain/src/gemini-advisory.ts`) so no call site can paraphrase or typo it, per [ADR 0004](../adr/0004-local-ml-primary-gemini-advisory.md) and BLOCK 22.

## Error Message Conventions

- Error messages describe what happened and, where possible, what the user can do next — never a bare technical message ("Error 500") shown to an end user without a human-readable explanation alongside it.
- Never reveal whether a specific account/email exists (see Password Reset Request in [SCREEN_INVENTORY.md](SCREEN_INVENTORY.md)) — avoid enumeration-enabling phrasing.
- Never reveal internal state, stack traces, or database error text — pair a generic message with an optional correlation/error ID for support purposes, per [SCREEN_INVENTORY.md](SCREEN_INVENTORY.md) Generic Error screen.
- Distinguish clearly between "koneksi bermasalah" (connectivity issue — retryable, often not the user's fault) and "data tidak valid" (invalid input — the user needs to correct something) — these should never share the same generic phrasing, since the correct next action differs.

## Empty State Conventions

- An empty state is not automatically bad news — many empty states in MBOYO are positive (empty Verifier queue, empty offline queue meaning everything synced). Copy must reflect this: "Antrean kosong — semua laporan telah diverifikasi" reads as an accomplishment, not a dead end.
- Genuinely first-time/onboarding empty states (e.g., Reporter's first visit to Laporan Saya) should include a clear path to the relevant primary action, not just a flat "no data" statement.
- Never fabricate placeholder data to avoid showing an empty state — an empty chart with honest "data belum cukup" copy is required over a fake-looking populated chart, per [AGENTS.md](../../AGENTS.md) ML/data honesty rules extended to UI content.

## Formatting Conventions

- Dates/times: use a consistent Indonesian locale format (e.g., "16 Juli 2026, 14:30 WIB") — never a raw ISO timestamp in user-facing copy.
- Coordinates, model versions, and IDs are rendered in IBM Plex Mono per the brand typography spec, and are not translated (they're not language-dependent content).
- Numbers use Indonesian formatting conventions (period as thousands separator, comma as decimal separator) where locale-sensitive values are shown to end users; metrics intended for a technical/Auditor audience (e.g., macro-F1 to four decimal places) may use standard decimal notation with a comma per Indonesian convention, applied consistently.
- Percentages/probabilities are always shown with an explicit unit ("72%"), never a bare decimal, to avoid ambiguity for non-technical Verifier users.

## Cross-Reference Discipline

- Every button label used in [SCREEN_INVENTORY.md](SCREEN_INVENTORY.md) should match a term defined here — if a future screen needs a new term, add it to this guide before or alongside that screen's Stitch design, not after implementation.
- [STITCH_HANDOFF.md](STITCH_HANDOFF.md) references this guide as the copy source that Stitch designs must use verbatim for shared/canonical terms.
