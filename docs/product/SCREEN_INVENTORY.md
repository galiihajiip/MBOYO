# MBOYO Screen Inventory

Full specification for every screen in [INFORMATION_ARCHITECTURE.md](INFORMATION_ARCHITECTURE.md). Each screen defines: **Role**, **Route**, **Purpose**, **Data**, **Primary CTA**, **Secondary Actions**, **Forbidden Actions**, **Loading**, **Empty**, **Error**, **Permission**, **Offline Behavior**, **Responsive Hierarchy** (desktop/tablet/mobile).

This is the Google Stitch design source of truth — do not implement any screen in code before its design is generated and approved per the Design Gate in [DELIVERY_ROADMAP.md](DELIVERY_ROADMAP.md).

---

## Public Screens

### Landing Page (Header, Hero, Footer)

- **Role:** Public (unauthenticated).
- **Route:** `/`
- **Purpose:** Introduce MBOYO, communicate the tagline and mission, drive to login/register. Composed of three regions:
  - **Header:** logo/wordmark, "Masuk" (Login) and "Daftar" (Register) CTAs, no full nav (public visitors don't need role navigation).
  - **Hero:** tagline "Laporan Tetap Jalan. Respons Lebih Tepat.", one-line mission statement, primary CTA.
  - **Footer:** links (Bantuan, Tentang, Kontak), organization attribution, no language switcher at MVP (Bahasa Indonesia only per [AGENTS.md](../../AGENTS.md)).
- **Data:** Static marketing content; no entity data.
- **Primary CTA:** "Daftar sebagai Pelapor" (Register as Reporter) — the primary registration path, since Reporter is the only self-service role (all other roles are granted by System Administrator per [RBAC_MATRIX.md](RBAC_MATRIX.md)).
- **Secondary Actions:** "Masuk" (Login) link, footer navigation links.
- **Forbidden Actions:** No self-service registration for Verifier/Coordinator/Administrator/Auditor roles — these are granted only via `role_assignment` by System Administrator, never through public sign-up.
- **Loading:** Static page, effectively instant; hero image/illustration may lazy-load with a placeholder.
- **Empty:** Not applicable (static content).
- **Error:** If the page itself fails to load, standard browser error applies; no custom in-app error state needed since there's no data dependency.
- **Permission:** Fully public, no auth required.
- **Offline Behavior:** Cacheable via service worker precache (Workbox) so the landing page is viewable offline on repeat visits, though first visit requires connectivity.
- **Responsive Hierarchy:**
  - Desktop: horizontal header, full-width hero with side-by-side text/illustration, multi-column footer.
  - Tablet: horizontal header, stacked hero (text above illustration), two-column footer.
  - Mobile: hamburger-free simplified header (logo + single "Masuk" CTA, "Daftar" as hero's primary action instead), stacked hero, single-column footer.

### Login

- **Role:** Public (unauthenticated).
- **Route:** `/masuk`
- **Purpose:** Authenticate an existing user via Supabase Auth.
- **Data:** None persisted here beyond the session created on success.
- **Primary CTA:** "Masuk" (submit login form).
- **Secondary Actions:** "Lupa kata sandi?" (forgot password) link, "Belum punya akun? Daftar" (register) link.
- **Forbidden Actions:** No role selection at login — role is determined server-side from `role_assignment`, never client-chosen.
- **Loading:** Submit button shows a spinner/disabled state during authentication request.
- **Empty:** Not applicable.
- **Error:** Invalid credentials → inline field-level error message ("Email atau kata sandi salah"); account locked/suspended → distinct message directing to support; network failure → toast "Tidak dapat terhubung, periksa koneksi Anda."
- **Permission:** Public.
- **Offline Behavior:** Login requires connectivity (cannot authenticate against Supabase Auth offline); if offline, form shows a disabled state with a message explaining login requires an internet connection — this does not violate offline-first invariants since those apply to report creation, not authentication.
- **Responsive Hierarchy:**
  - Desktop: centered card, ~400px wide, on a branded background.
  - Tablet: same centered card pattern, slightly narrower margins.
  - Mobile: full-width form with standard padding, no card border.

### Register

- **Role:** Public (unauthenticated) — creates a Reporter-role account only, per [RBAC_MATRIX.md](RBAC_MATRIX.md) (other roles are admin-granted).
- **Route:** `/daftar`
- **Purpose:** Self-service account creation for Reporters.
- **Data:** Creates `profile` + Supabase Auth user + a `role_assignment` row with `role = reporter`.
- **Primary CTA:** "Daftar" (submit registration).
- **Secondary Actions:** "Sudah punya akun? Masuk" (login) link.
- **Forbidden Actions:** Cannot self-assign any role other than Reporter; no organization-selection field beyond the single MVP organization.
- **Loading:** Submit button spinner/disabled during account creation.
- **Empty:** Not applicable.
- **Error:** Email already registered → inline error; weak password → inline validation guidance; network failure → toast.
- **Permission:** Public.
- **Offline Behavior:** Requires connectivity, same rationale as Login.
- **Responsive Hierarchy:** Same pattern as Login (centered card → full-width form on mobile).

### Password Reset Request

- **Role:** Public.
- **Route:** `/lupa-kata-sandi`
- **Purpose:** Request a password-reset email.
- **Data:** None persisted client-side; triggers Supabase Auth reset flow.
- **Primary CTA:** "Kirim tautan reset" (send reset link).
- **Secondary Actions:** "Kembali ke Masuk" (back to login).
- **Forbidden Actions:** None role-specific.
- **Loading:** Submit button spinner.
- **Empty:** Not applicable.
- **Error:** Invalid/unregistered email is not distinguished in the error message (avoid account enumeration) — generic "Jika email terdaftar, tautan reset telah dikirim" shown regardless of whether the account exists.
- **Permission:** Public.
- **Offline Behavior:** Requires connectivity.
- **Responsive Hierarchy:** Same centered-card pattern as Login.

### Password Reset Confirmation

- **Role:** Public (via emailed token link).
- **Route:** `/reset-kata-sandi`
- **Purpose:** Set a new password using a valid reset token.
- **Data:** Updates the Supabase Auth user's password.
- **Primary CTA:** "Simpan kata sandi baru" (save new password).
- **Secondary Actions:** None.
- **Forbidden Actions:** None role-specific.
- **Loading:** Submit button spinner.
- **Empty:** Not applicable.
- **Error:** Expired/invalid token → full-page message with a link back to the reset-request screen, not a form error (the form shouldn't render at all if the token is invalid).
- **Permission:** Public, gated by a valid token in the URL.
- **Offline Behavior:** Requires connectivity.
- **Responsive Hierarchy:** Same centered-card pattern as Login.

### Public Help/About

- **Role:** Public.
- **Route:** `/bantuan-publik`
- **Purpose:** General information about MBOYO for visitors who aren't yet registered (distinct from Reporter's authenticated "Bantuan" screen, which includes in-app capture guidance).
- **Data:** Static content.
- **Primary CTA:** "Daftar sebagai Pelapor" (register).
- **Secondary Actions:** Links to specific FAQ sections.
- **Forbidden Actions:** None.
- **Loading:** Static, effectively instant.
- **Empty:** Not applicable.
- **Error:** Not applicable.
- **Permission:** Public.
- **Offline Behavior:** Precached, viewable offline.
- **Responsive Hierarchy:** Simple single-column article layout at all breakpoints, with a wider max-width on desktop for readability.

---

## Reporter Screens

### Beranda (Home)

- **Role:** Reporter.
- **Route:** `/pelapor/beranda`
- **Purpose:** Landing screen after login — connectivity status, pending sync count, quick-start to report creation.
- **Data:** `report` (own, aggregate counts by status, especially `queued_offline`/`syncing`).
- **Primary CTA:** "Buat Laporan Baru" (create new report) — always visible, works offline.
- **Secondary Actions:** Link to "Antrean Offline" if pending items exist; link to "Laporan Saya."
- **Forbidden Actions:** No access to other reporters' data; no verification/dispatch actions anywhere on this screen.
- **Loading:** Skeleton cards for the status summary while `report` counts load.
- **Empty:** First-time user with zero reports — friendly empty state encouraging first report creation, not an error.
- **Error:** If the summary fetch fails while online, show a retry affordance; this must not block the primary CTA (report creation works regardless).
- **Permission:** Reporter role required; RLS scopes all data to `reporter_profile_id = self`.
- **Offline Behavior:** Fully usable offline — status summary reads from local IndexedDB cache of last-known counts if the network fetch fails; primary CTA always enabled.
- **Responsive Hierarchy:**
  - Desktop: two-column layout (status summary cards left, quick actions/tips right).
  - Tablet: single column, status cards in a horizontal scroll row above quick actions.
  - Mobile: single column, stacked, primary CTA as a persistent bottom button or prominent top card.

### Buat Laporan (Report Wizard)

- **Role:** Reporter.
- **Route:** `/pelapor/laporan/baru` (multi-step, e.g., `?step=foto`, `?step=lokasi`, `?step=detail`, `?step=konfirmasi`)
- **Purpose:** The offline-capable report creation flow — the entry point to the [MVP live flow](PRODUCT_CHARTER.md#the-mvp-live-flow). Steps: (1) capture/select photo, (2) capture GPS (or mark low-confidence if unavailable), (3) description/detail fields, (4) review and submit.
- **Data:** Creates `report`, `report_evidence`, `geolocation_observation` (all local-first, in `draft_local` state until save).
- **Primary CTA:** Per step — "Lanjut" (continue) on steps 1–3, "Kirim Laporan" (submit report) on step 4. Submission is local-save-then-queue, not a blocking network call.
- **Secondary Actions:** "Kembali" (back) between steps; "Simpan sebagai draf" (save as draft) if the Reporter wants to pause mid-wizard.
- **Forbidden Actions:** No field for setting severity/priority (that's Verifier/Coordinator territory) — the Reporter only describes what they observed; no way to submit without at least an attempted photo capture (though a low-quality/no-GPS submission is still allowed, per [RISK_REGISTER.md](../product/RISK_REGISTER.md) risk #3/#4 — the flow must not hard-block on GPS).
- **Loading:** Photo capture/upload-to-local-queue shows a brief processing indicator (e.g., image compression before local save); this is local processing, not a network wait.
- **Empty:** Not applicable (this is a creation flow, not a list).
- **Error:** Camera/GPS permission denied → inline guidance with a path to continue anyway (low-confidence flag) rather than a dead end; local storage write failure (rare, e.g., storage quota exceeded) → explicit error explaining the report could not be saved locally, since this is a genuine failure of the offline-first guarantee and must never be silently swallowed.
- **Permission:** Reporter role required.
- **Offline Behavior:** This is the canonical offline-first screen — every step must function with zero network connectivity; the final "Kirim Laporan" action writes to IndexedDB (Dexie) and returns immediately, per [ADR 0005](../adr/0005-offline-indexeddb-workbox.md) and [SEQUENCE_FLOWS.md](../architecture/SEQUENCE_FLOWS.md) Diagram 3.
- **Responsive Hierarchy:**
  - Desktop: side-by-side step content and a persistent progress indicator/summary panel.
  - Tablet: single column with a horizontal step indicator at top.
  - Mobile: single column, full-screen per step, large touch targets for camera/GPS capture buttons (this is the primary field-use form factor).

### Antrean Offline (Offline Queue)

- **Role:** Reporter.
- **Route:** `/pelapor/antrean`
- **Purpose:** Show locally queued reports and their sync status.
- **Data:** `report` (own, local/pre-sync states: `draft_local`, `queued_offline`, `syncing`).
- **Primary CTA:** "Coba sinkronkan sekarang" (try sync now) — manual sync trigger, supplementary to automatic Background Sync.
- **Secondary Actions:** Tap a queued item to view/edit before it syncs (only while still `draft_local`); delete a draft.
- **Forbidden Actions:** Cannot edit a report once it has entered `syncing`/`submitted` — a Reporter's evidence becomes immutable once submitted, per [AGENTS.md](../../AGENTS.md).
- **Loading:** Skeleton list while reading from IndexedDB (should be near-instant, local-only).
- **Empty:** "Tidak ada laporan dalam antrean" (no reports in queue) — a genuinely good state, not an error, since it means everything has synced.
- **Error:** A specific queued item that repeatedly fails to sync shows an inline error badge with a reason (e.g., "Koneksi bermasalah, akan dicoba lagi" — connection issue, will retry) — never silently dropped, per [AGENTS.md](../../AGENTS.md) offline-first invariants.
- **Permission:** Reporter role required; entirely local data, no server round-trip needed to view.
- **Offline Behavior:** This screen's entire purpose is offline visibility — it must render fully from IndexedDB with zero network dependency.
- **Responsive Hierarchy:**
  - Desktop: table-like list with status column, timestamp, thumbnail.
  - Tablet: card list, two-column grid.
  - Mobile: single-column card list, status as a colored badge per item.

### Laporan Saya (My Reports)

- **Role:** Reporter.
- **Route:** `/pelapor/laporan`
- **Purpose:** Full history of own reports across their lifecycle, including post-verification status.
- **Data:** `report` (own, all states).
- **Primary CTA:** "Buat Laporan Baru" (secondary entry point, same as Beranda).
- **Secondary Actions:** Filter by status; tap into a report's detail.
- **Forbidden Actions:** No visibility into `model_prediction`, `model_explanation`, or `verification_review` detail (Verifier-only data) — the Reporter sees only their own report's outcome status (e.g., "Terverifikasi" / "Ditolak"), not the underlying probabilities or Verifier notes.
- **Loading:** Skeleton list while fetching from server (for synced reports) merged with local queue state.
- **Empty:** First-time user — same empty state as Beranda's zero-report case, pointing to report creation.
- **Error:** Fetch failure while online → retry affordance; local/queued items still render from IndexedDB regardless of server fetch success.
- **Permission:** Reporter role required; RLS scopes to own reports only.
- **Offline Behavior:** Local/queued reports render from IndexedDB; synced/server-side status requires connectivity to refresh, but last-known state is cached and shown with a staleness indicator if offline.
- **Responsive Hierarchy:**
  - Desktop: table list with status, date, thumbnail columns.
  - Tablet: two-column card grid.
  - Mobile: single-column card list.

### Laporan Saya — Detail (Own Report Detail)

- **Role:** Reporter.
- **Route:** `/pelapor/laporan/[id]`
- **Purpose:** View a single own report's full detail and current status.
- **Data:** `report` (own), `report_evidence` (own), `geolocation_observation` (own); status-only reflection of `verification_review` (decision label, not internal notes/probabilities).
- **Primary CTA:** Contextual — "Tanggapi Permintaan Informasi" (respond to information request) if the report's status reflects a Verifier `request_info` decision; otherwise no primary action (this is largely a read view once submitted).
- **Secondary Actions:** View full-size evidence photo; view location on a simple map.
- **Forbidden Actions:** No edit of evidence/description once submitted (immutable per [AGENTS.md](../../AGENTS.md)); no view of Verifier's internal notes, model probabilities, or other reporters' related reports.
- **Loading:** Skeleton detail view.
- **Empty:** Not applicable (a specific report always has content).
- **Error:** Report not found/not owned by this Reporter → same as [Not Found](#not-found-404) or [Unauthorized](#unauthorized-403--role-mismatch), never leak existence of another reporter's report.
- **Permission:** Reporter role required; RLS enforces `reporter_profile_id = self`.
- **Offline Behavior:** If the report is still local-only (pre-sync), renders entirely from IndexedDB; once synced, requires connectivity for the latest status but shows last-cached status offline with a staleness note.
- **Responsive Hierarchy:**
  - Desktop: two-column (evidence/map left, status/timeline right).
  - Tablet: stacked, evidence above status.
  - Mobile: stacked, full-width evidence image, status card below.

### Bantuan (Help)

- **Role:** Reporter.
- **Route:** `/pelapor/bantuan`
- **Purpose:** In-app help content specific to Reporter workflows — capture tips (photo quality, GPS troubleshooting per [RISK_REGISTER.md](../product/RISK_REGISTER.md) risks #3–4), offline/sync explanation.
- **Data:** Static content.
- **Primary CTA:** None (informational screen).
- **Secondary Actions:** Links to specific help topics; contact/support link.
- **Forbidden Actions:** None.
- **Loading:** Static, instant.
- **Empty:** Not applicable.
- **Error:** Not applicable.
- **Permission:** Reporter role required (authenticated variant of the public help page, with in-app-specific content).
- **Offline Behavior:** Precached, fully viewable offline — especially important since this includes guidance for using the app while offline.
- **Responsive Hierarchy:** Single-column article layout at all breakpoints, wider max-width on desktop.

### Profil (Reporter)

- **Role:** Reporter (pattern shared structurally across all five roles' own-profile screens — see the [Shared Profil Pattern](#shared-profil-pattern-all-roles) below for the common specification; role-specific notes only listed here).
- **Route:** `/pelapor/profil`
- **Purpose:** View/edit own profile fields.
- **Data:** `profile` (own).
- **Role-specific note:** No role-assignment display beyond "Pelapor" (Reporter) label — a Reporter never sees a role-switcher, since role is admin-granted.

---

## Verifier Screens

### Ringkasan (Summary Dashboard)

- **Role:** Verifier.
- **Route:** `/verifikator/ringkasan`
- **Purpose:** At-a-glance queue depth, SLA status, and recent decisions.
- **Data:** `report`, `verification_review` (aggregate counts, SLA timers per [SUCCESS_METRICS.md](../product/SUCCESS_METRICS.md) Verification SLA).
- **Primary CTA:** "Buka Antrean Verifikasi" (open verification queue) — the main work entry point.
- **Secondary Actions:** Quick links to "Permintaan Informasi" and recent decision history.
- **Forbidden Actions:** No dispatch/priority-setting actions anywhere on this screen (Coordinator-only, per [AGENTS.md](../../AGENTS.md)).
- **Loading:** Skeleton cards for each metric.
- **Empty:** Zero queue depth — a genuinely good state ("Antrean kosong — semua laporan telah diverifikasi") not an error.
- **Error:** Fetch failure → retry affordance; stale-but-cached data shown with a "last updated" timestamp if refresh fails.
- **Permission:** Verifier role required.
- **Offline Behavior:** Verifier work is not offline-first (this role operates from a fixed post reviewing synced data) — if offline, show a clear "Anda sedang offline — data mungkin tidak terbaru" (you are offline — data may not be current) banner rather than pretending live data is available.
- **Responsive Hierarchy:**
  - Desktop: grid of metric cards (queue depth, SLA, recent decisions) with a chart/sparkline per metric.
  - Tablet: two-column metric grid.
  - Mobile: single-column stacked cards.

### Antrean Verifikasi (Verification Queue)

- **Role:** Verifier.
- **Route:** `/verifikator/antrean`
- **Purpose:** Primary work queue — reports in `analysis_completed`/`needs_manual_review`, ready for review.
- **Data:** `report`, `model_prediction` (severity probabilities, quality/duplicate signals), `geolocation_observation` (confidence).
- **Primary CTA:** "Tinjau" (review) on each queue item, opening the detail/decision screen.
- **Secondary Actions:** Sort/filter by severity, quality, escalation flag, age; bulk-select for triage (view only, decisions remain per-report).
- **Forbidden Actions:** No decision can be made from the list view itself — confirm/override/reject/request-info/escalate only happens on the detail screen, ensuring the Verifier has actually opened the evidence before deciding.
- **Loading:** Skeleton rows.
- **Empty:** "Antrean kosong" — positive empty state.
- **Error:** Fetch failure → retry; if `model_prediction` for an item is `is_advisory_only = true` (release gate not passed, per [SUCCESS_METRICS.md](../product/SUCCESS_METRICS.md)), this is not an error state but a visibly labeled advisory indicator on that queue item.
- **Permission:** Verifier role required.
- **Offline Behavior:** Requires connectivity for live queue data; same offline banner pattern as Ringkasan.
- **Responsive Hierarchy:**
  - Desktop: table with columns for thumbnail, severity probability summary, quality/location confidence badges, age.
  - Tablet: condensed table or card list with key badges visible.
  - Mobile: card list, one report per card, tap to open detail.

### Antrean Verifikasi — Detail (Report Review/Decision Screen)

- **Role:** Verifier.
- **Route:** `/verifikator/antrean/[reportId]` in this original spec — implemented at `/verifier/laporan/[reportId]`, matching the English route-slug convention already established for every other role's routes in this codebase (`/verifier/...`, not `/verifikator/...`), consistent with earlier blocks' own divergence from this document's originally-proposed Indonesian route slugs.
- **BLOCK 22 note:** the real page built in that block covers the local-model-prediction display and the optional Gemini advisory panel ("Analisis Tambahan Eksternal — Tidak Menentukan Keputusan Resmi") described below under a new subsection; the confirm/override/reject/request_info/escalate decision panel itself (this section's Primary CTA) is not yet wired into that page — `submitVerificationDecision`'s service/route already exist (BLOCK 16) and are ready to be added to this same page as a follow-up, not a new one.
- **Purpose:** The core human-verification screen — full evidence, model output, and the decision action itself.
- **Data:** `report`, `report_evidence` (full-size, immutable), `geolocation_observation` (with confidence and geofence cross-check result), `model_prediction` (severity probabilities per class, quality score, duplicate candidate), `model_explanation` (saliency/explanation payload).
- **Primary CTA:** Decision actions — "Konfirmasi" (confirm), "Ganti Klasifikasi" (override), "Tolak" (reject), "Minta Informasi" (request info), "Eskalasi" (escalate) — presented as a clear decision panel, not buried in a menu, since this is the single most consequential action in the product.
- **Secondary Actions:** View duplicate-candidate report side-by-side if flagged; view location on a map inset; add notes (required on override/reject/escalate, optional on confirm).
- **Forbidden Actions:** No edit of the evidence photo, GPS data, or model probabilities themselves — the Verifier's output is strictly a new `verification_review` row, never a mutation of what it's reviewing, per [AGENTS.md](../../AGENTS.md) and [RBAC_MATRIX.md](../product/RBAC_MATRIX.md).
- **Loading:** Skeleton for evidence image and probability chart while data loads; decision buttons disabled until all data has loaded (a Verifier should not be able to decide before seeing the evidence).
- **Empty:** Not applicable (a specific report always has content by the time it reaches this screen).
- **Error:** If `model_prediction` failed to generate (report is `needs_manual_review` due to inference failure), show an explicit "Analisis AI tidak tersedia — tinjau bukti secara manual" (AI analysis unavailable — review evidence manually) state rather than a blank/broken probability panel — this is a real state, not a bug, per the abstention/advisory-only design in [SUCCESS_METRICS.md](../product/SUCCESS_METRICS.md).
- **Permission:** Verifier role required.
- **Offline Behavior:** Requires connectivity (cannot fetch evidence/predictions offline, and a decision is a server write); if connectivity drops mid-review, decision buttons disable with a clear "Koneksi terputus" message rather than allowing a decision that can't be persisted.
- **Responsive Hierarchy:**
  - Desktop: three-column (evidence/media left, probability/quality/location panel center, decision action panel right, persistently visible).
  - Tablet: two-column (evidence + data stacked left, decision panel right, or decision panel as a bottom sheet).
  - Mobile: single column, evidence first, then data panels, decision actions as a persistent bottom action bar (always reachable without scrolling back up).

### Analisis Tambahan Eksternal (Gemini Advisory Panel — BLOCK 22)

- **Role:** Verifier.
- **Route:** embedded within the report-detail screen above (`/verifier/laporan/[reportId]`), not a separate route.
- **Purpose:** An optional, Verifier-triggered external advisory (evidence summary, one suggested follow-up question, a non-binding hypothesis, quality observations) — never a probability input, never authoritative, never automatically triggered.
- **Data:** `gemini_advisory_request` rows for this report (status, structured output, model name, latency, retry count — never the raw prompt or chain-of-thought).
- **Primary CTA:** "Minta Analisis Tambahan Eksternal" (request external supplementary analysis) — disabled until the Verifier selects a data-disclosure level (none / redacted image / raw image) and, if an image is selected, accepts both the consent and external-cloud-disclosure checkboxes.
- **Forbidden Actions:** Cannot change `report.status` or create a `verification_review`; cannot be triggered automatically (no polling, no on-page-load call); a raw evidence image cannot be sent without both acknowledgements explicitly checked for that specific request.
- **Loading:** Button shows "Meminta analisis..." and disables while the call is in flight; existing advisory history renders immediately from the page's initial server-side load, independent of any new request.
- **Empty:** If `GEMINI_API_KEY` is not configured, the panel renders a disabled, explanatory state ("Fitur ini belum diaktifkan pada sistem ini") instead of the request form — the rest of the Verifier workflow is entirely unaffected.
- **Error:** A failed/timed-out/rate-limited call still renders as a history entry (not a toast that disappears) — Verifiers can see what was already attempted for this report, per this block's complete-audit-trail requirement.
- **Permission:** Verifier role required (`gemini_advisory_request:create`/`:read` — see [RBAC_MATRIX.md](../product/RBAC_MATRIX.md)); Auditor has read-only access to the same history.
- **Offline Behavior:** Requires connectivity — this panel is never usable offline, consistent with every other Verifier server-write action.

### Peta Bukti (Evidence Map)

- **Role:** Verifier.
- **Route:** `/verifikator/peta`
- **Purpose:** Map view of incoming evidence by location, to spot spatial patterns ahead of/alongside per-report review.
- **Data:** `report`, `geolocation_observation` (pins), aggregated by proximity for clustering at low zoom.
- **Primary CTA:** Tap a pin → navigate to that report's review detail.
- **Secondary Actions:** Toggle layers (e.g., show only `needs_manual_review`); filter by severity probability range.
- **Forbidden Actions:** No verification decision from the map itself — map is navigation/context only.
- **Loading:** Map tile loading skeleton; pin data loads asynchronously and can populate after the base map renders.
- **Empty:** No reports with location data yet — map renders at a default/event-centered view with an empty-state message overlay.
- **Error:** Map tile provider failure → fallback to the list view (Semua Laporan) with a clear message, per [RISK_REGISTER.md](../product/RISK_REGISTER.md) risk #7 / [DEPLOYMENT_TOPOLOGY.md](../architecture/DEPLOYMENT_TOPOLOGY.md) resilience note — the map is an enhancement, never the only way to see incident locations.
- **Permission:** Verifier role required.
- **Offline Behavior:** Requires connectivity (map tiles + live pin data); offline shows the same connectivity banner and disables the map in favor of a message directing to previously cached list data if any.
- **Responsive Hierarchy:**
  - Desktop: full-height map with a filter panel docked left/right.
  - Tablet: full-height map with filter panel as a collapsible drawer.
  - Mobile: full-screen map with filters in a bottom sheet, pin tap opens a compact preview card before full navigation to detail.

### Semua Laporan (All Reports)

- **Role:** Verifier.
- **Route:** `/verifikator/laporan`
- **Purpose:** Full report list across all statuses, for lookup/reference beyond the active queue.
- **Data:** `report` (all, all states).
- **Primary CTA:** Tap a row → report detail (read view if not in an actionable state, or the decision screen if still pending).
- **Secondary Actions:** Search/filter by status, event, date range, reporter.
- **Forbidden Actions:** No bulk decision actions.
- **Loading:** Skeleton table/list.
- **Empty:** "Belum ada laporan" only plausible before any event has reports — otherwise this state is unlikely at MVP scale.
- **Error:** Fetch failure → retry affordance.
- **Permission:** Verifier role required (read access to all reports, per [RBAC_MATRIX.md](../product/RBAC_MATRIX.md)).
- **Offline Behavior:** Requires connectivity; same offline banner pattern.
- **Responsive Hierarchy:**
  - Desktop: full data table with sortable columns.
  - Tablet: condensed table.
  - Mobile: card list with key fields (status, severity, date).

### Permintaan Informasi (Information Requests)

- **Role:** Verifier.
- **Route:** `/verifikator/permintaan-informasi`
- **Purpose:** Track reports where the Verifier chose "request info" — follow-up state pending Reporter response.
- **Data:** `report`, `verification_review` (decision = `request_info`).
- **Primary CTA:** Tap an item → return to the report detail to make a final decision once the Reporter has responded.
- **Secondary Actions:** Filter by "menunggu tanggapan" (awaiting response) vs. "tanggapan diterima" (response received).
- **Forbidden Actions:** None beyond standard Verifier scope.
- **Loading:** Skeleton list.
- **Empty:** "Tidak ada permintaan informasi tertunda" (no pending information requests) — positive state.
- **Error:** Fetch failure → retry.
- **Permission:** Verifier role required.
- **Offline Behavior:** Requires connectivity.
- **Responsive Hierarchy:** Same list pattern as Semua Laporan (desktop table → mobile card list).

### Notifikasi (Verifier)

Shared structural pattern — see [Shared Notifikasi Pattern](#shared-notifikasi-pattern-verifier-coordinator) below.

### Profil (Verifier)

Shared structure — see [Shared Profil Pattern](#shared-profil-pattern-all-roles).

---

## Response Coordinator Screens

### Command Center

- **Role:** Response Coordinator.
- **Route:** `/koordinator/command-center`
- **Purpose:** Primary operational dashboard — verified/escalated incidents needing attention, active task summary.
- **Data:** `report` (verified/escalated), `response_task` (aggregate by status/priority).
- **Primary CTA:** "Buat Tugas Respons" (create response task) from a highlighted incident.
- **Secondary Actions:** Links to Peta Krisis, Tugas Respons, Analitik.
- **Forbidden Actions:** No access to unverified reports, no verification decision actions, no evidence-mutation affordances.
- **Loading:** Skeleton cards/list.
- **Empty:** "Tidak ada insiden terverifikasi saat ini" (no verified incidents currently) — plausible and positive early in an event.
- **Error:** Fetch failure → retry; realtime subscription failure falls back to polling with a visible "diperbarui setiap beberapa menit" (updating every few minutes) note rather than silently going stale.
- **Permission:** Response Coordinator role required; RLS scopes to verified/escalated reports only.
- **Offline Behavior:** Requires connectivity; same offline banner pattern as Verifier screens (Coordinator work is not offline-first).
- **Responsive Hierarchy:**
  - Desktop: multi-panel dashboard (incident list left, task summary right, key metrics top).
  - Tablet: stacked panels, metrics as a horizontal scroll row.
  - Mobile: single-column, incident list first, task summary as a collapsible section.

### Peta Krisis (Crisis Map)

- **Role:** Response Coordinator.
- **Route:** `/koordinator/peta`
- **Purpose:** MapLibre map of verified incidents, with a non-map list/table fallback per [DEPLOYMENT_TOPOLOGY.md](../architecture/DEPLOYMENT_TOPOLOGY.md).
- **Data:** `report` (verified), `incident_cluster`.
- **Primary CTA:** Tap a pin/cluster → incident detail with "Buat Tugas Respons" or "Tambah ke Klaster" (add to cluster) actions.
- **Secondary Actions:** Toggle between map and list view explicitly (not just an automatic fallback — the Coordinator can choose list view even when the map works); draw/select a cluster grouping.
- **Forbidden Actions:** No editing of the underlying report/evidence from the map.
- **Loading:** Map tile skeleton; pins populate asynchronously.
- **Empty:** No verified incidents yet — map shows event-centered default view with an empty overlay message.
- **Error:** Map tile provider failure → automatic fallback to the list view with a clear explanatory message, per [RISK_REGISTER.md](../product/RISK_REGISTER.md) risk #7 — this is the specific screen where that resilience requirement is most directly tested.
- **Permission:** Response Coordinator role required.
- **Offline Behavior:** Requires connectivity for both map tiles and live incident data.
- **Responsive Hierarchy:**
  - Desktop: full-height map with a docked incident list/filter panel.
  - Tablet: full-height map with collapsible drawer.
  - Mobile: full-screen map with a view-toggle control to switch to the list, bottom sheet for pin details.

### Prioritas (Priority Workflow)

- **Role:** Response Coordinator.
- **Route:** `/koordinator/prioritas`
- **Purpose:** Dedicated priority-setting workflow across incidents/clusters/tasks — a triage-focused list distinct from the map, for quickly working through priority assignment.
- **Data:** `response_task`, `incident_cluster` (priority field: `unassigned`/`low`/`medium`/`high`/`critical`).
- **Primary CTA:** Set/change priority on an item (inline control, e.g., a segmented selector per row).
- **Secondary Actions:** Sort by current priority, by severity probability (as an input to the Coordinator's judgment, never auto-applied), by age.
- **Forbidden Actions:** Priority is never auto-derived or bulk-set purely from `model_prediction` severity without Coordinator action — per [STATE_MACHINES.md](STATE_MACHINES.md) Priority Levels section, severity is an input the Coordinator considers, not a value that sets itself.
- **Loading:** Skeleton list.
- **Empty:** "Tidak ada insiden yang memerlukan penentuan prioritas" (no incidents requiring priority determination).
- **Error:** Fetch/save failure → inline error on the specific row, with the priority control reverting to its last-saved value rather than showing an unsaved/ambiguous state.
- **Permission:** Response Coordinator role required.
- **Offline Behavior:** Requires connectivity; priority changes are direct writes, not queued locally.
- **Responsive Hierarchy:**
  - Desktop: table with an inline priority selector column.
  - Tablet: condensed table, same inline control.
  - Mobile: card list, priority selector as a prominent control per card.

### Tugas Respons (Task List)

- **Role:** Response Coordinator.
- **Route:** `/koordinator/tugas`
- **Purpose:** Task management list — create, view, filter tasks through the [task state machine](STATE_MACHINES.md#task-state-machine).
- **Data:** `response_task`, `task_assignment`.
- **Primary CTA:** "Buat Tugas Baru" (create new task).
- **Secondary Actions:** Filter by status (`draft`/`assigned`/`acknowledged`/`in_progress`/`blocked`/`completed`/`cancelled`), by priority, by assignee.
- **Forbidden Actions:** No task creation without a linked verified `report`/`incident_cluster` — a task cannot exist untethered from a verified incident.
- **Loading:** Skeleton list.
- **Empty:** "Belum ada tugas respons" (no response tasks yet) — plausible early in an event.
- **Error:** Fetch failure → retry.
- **Permission:** Response Coordinator role required.
- **Offline Behavior:** Requires connectivity.
- **Responsive Hierarchy:**
  - Desktop: table with status/priority/assignee columns, kanban-style grouping optional.
  - Tablet: condensed table or column-grouped card view.
  - Mobile: card list grouped/filterable by status.

### Tugas Respons — Detail (Task Detail/Assignment)

- **Role:** Response Coordinator (creation/assignment/status actions); the assignee (acknowledge/start/block/complete actions per [STATE_MACHINES.md](STATE_MACHINES.md), scoped to their own assigned tasks).
- **Route:** `/koordinator/tugas/[id]`
- **Purpose:** Full task detail — linked incident, assignment, status timeline, priority.
- **Data:** `response_task`, `task_assignment`, linked `report`/`incident_cluster` (verified, read-only reference).
- **Primary CTA:** Contextual by state — "Tetapkan" (assign) on `draft`, "Konfirmasi" (acknowledge) for the assignee on `assigned`, "Mulai" (start) on `acknowledged`, "Tandai Selesai" (mark complete) on `in_progress`, per [STATE_MACHINES.md](STATE_MACHINES.md).
- **Secondary Actions:** "Laporkan Kendala" (report a blocker) during `in_progress`; "Batalkan Tugas" (cancel task) — Coordinator only, per the state machine's explicit restriction that only the Coordinator can cancel.
- **Forbidden Actions:** An assignee cannot cancel their own task (Coordinator-exclusive per [STATE_MACHINES.md](STATE_MACHINES.md)); no editing of the linked report's evidence/verification detail from this screen (reference/read-only link only).
- **Loading:** Skeleton detail view.
- **Empty:** Not applicable (a specific task always has content).
- **Error:** Invalid state transition attempted (e.g., stale UI trying to acknowledge an already-cancelled task) → explicit error explaining the task's current state, refetching to resync the UI, rather than a generic failure.
- **Permission:** Response Coordinator (full); assignee (own-task status actions only) — enforced server-side/RLS, not just hidden buttons.
- **Offline Behavior:** Requires connectivity; status-transition actions are direct writes.
- **Responsive Hierarchy:**
  - Desktop: two-column (task detail/timeline left, linked-incident reference panel right).
  - Tablet: stacked, incident reference as a collapsible section.
  - Mobile: stacked, action buttons as a persistent bottom bar reflecting the current valid transition(s).

### Analitik (Analytics Dashboard)

- **Role:** Response Coordinator.
- **Route:** `/koordinator/analitik`
- **Purpose:** Recharts-based dashboard — counts by severity/status/region (Enhanced Demo tier per [MVP_SCOPE.md](../product/MVP_SCOPE.md)).
- **Data:** `report`, `response_task` (aggregated, never raw evidence).
- **Primary CTA:** None (dashboard is primarily consumptive); "Ekspor Data Ini" (export this data) may deep-link to Ekspor with current filters applied.
- **Secondary Actions:** Filter by date range, event, severity.
- **Forbidden Actions:** No drill-down that exposes raw evidence photos or Verifier notes from this screen — analytics is aggregate-level.
- **Loading:** Skeleton charts.
- **Empty:** Insufficient data for a meaningful chart (e.g., a brand-new event) → explicit "Data belum cukup untuk ditampilkan" (not enough data to display yet) rather than an empty/broken-looking chart.
- **Error:** Fetch failure → retry, per-chart if partial failure is possible.
- **Permission:** Response Coordinator role required.
- **Offline Behavior:** Requires connectivity.
- **Responsive Hierarchy:**
  - Desktop: multi-chart grid (2–3 columns).
  - Tablet: two-column chart grid.
  - Mobile: single-column stacked charts, horizontally scrollable where a chart doesn't compress well (e.g., a wide time-series).

### Ekspor (Export)

- **Role:** Response Coordinator.
- **Route:** `/koordinator/ekspor`
- **Purpose:** Initiate and retrieve data exports (CSV/GeoJSON) for a selected event.
- **Data:** `export_job` (own).
- **Primary CTA:** "Buat Ekspor Baru" (create new export) — select event, format, filter criteria.
- **Secondary Actions:** Download a completed export; view export history/status.
- **Forbidden Actions:** Export excludes raw evidence and unnecessary reporter PII by default, per [PRODUCTION_SCOPE.md](../product/PRODUCTION_SCOPE.md) — there is no UI option to include raw evidence in a Coordinator-initiated export.
- **Loading:** Skeleton for export history list; in-progress export shows a status indicator (`queued`/`processing`/`done`/`failed`, mirroring `export_job.status`).
- **Empty:** "Belum ada ekspor" (no exports yet) — plausible before first use.
- **Error:** Export generation failure → explicit error with a retry action; never a silent "done" state on a failed export.
- **Permission:** Response Coordinator role required; RLS scopes to own `export_job` records.
- **Offline Behavior:** Requires connectivity to initiate/download.
- **Responsive Hierarchy:**
  - Desktop: form panel + history table side by side.
  - Tablet: stacked, form above history.
  - Mobile: stacked, form as a modal/full-screen step, history as a simple list below the entry point.

### Notifikasi (Coordinator)

Shared structural pattern — see [Shared Notifikasi Pattern](#shared-notifikasi-pattern-verifier-coordinator).

### Profil (Coordinator)

Shared structure — see [Shared Profil Pattern](#shared-profil-pattern-all-roles).

---

## System Administrator Screens

### Administrasi (Org Overview)

- **Role:** System Administrator.
- **Route:** `/admin/administrasi`
- **Purpose:** Organization-level overview — org settings summary, active event count, quick links into the other admin sections.
- **Data:** `organization`, `disaster_event` (summary).
- **Primary CTA:** "Kelola Pengguna & Role" or "Kelola Event" depending on which needs attention (contextual), or simply a clear set of section links.
- **Secondary Actions:** Links to all other admin sections.
- **Forbidden Actions:** No report validation or task dispatch action anywhere on this screen or any admin screen — per [RBAC_MATRIX.md](../product/RBAC_MATRIX.md) and [NAVIGATION_BY_ROLE.md](NAVIGATION_BY_ROLE.md), Administrator navigation must never expose these.
- **Loading:** Skeleton summary cards.
- **Empty:** Not applicable at MVP (org and at least one event always exist by the time an Administrator logs in).
- **Error:** Fetch failure → retry.
- **Permission:** System Administrator role required.
- **Offline Behavior:** Requires connectivity; admin work is not offline-first.
- **Responsive Hierarchy:**
  - Desktop: grid of section summary cards.
  - Tablet: two-column grid.
  - Mobile: single-column stacked cards.

### Pengguna & Role (Users and Roles)

- **Role:** System Administrator.
- **Route:** `/admin/pengguna`
- **Purpose:** User and role-assignment management — the only place `role_assignment` is mutated.
- **Data:** `profile`, `role_assignment`.
- **Primary CTA:** "Tambah Pengguna" (add user) or "Berikan Role" (grant role) to an existing profile.
- **Secondary Actions:** Revoke a role assignment; suspend a user account (ties to [THREAT_MODEL.md](../security/THREAT_MODEL.md) threat #1 fake-report recovery).
- **Forbidden Actions:** Cannot grant a role that creates an overlapping mutation authority inconsistent with [RBAC_MATRIX.md](../product/RBAC_MATRIX.md) — the role-grant UI only offers the five defined roles, never a custom/combined role.
- **Loading:** Skeleton table.
- **Empty:** Not applicable (at least the Administrator's own account exists).
- **Error:** Fetch/save failure → inline error, revert to last-saved state.
- **Permission:** System Administrator role required, exclusively — per [RBAC_MATRIX.md](../product/RBAC_MATRIX.md), no other role has any access to `role_assignment` beyond reading their own.
- **Offline Behavior:** Requires connectivity.
- **Responsive Hierarchy:**
  - Desktop: full data table with role badges, inline actions.
  - Tablet: condensed table.
  - Mobile: card list, one user per card, role badges and actions in an expandable section.

### Event Bencana (Disaster Events)

- **Role:** System Administrator.
- **Route:** `/admin/event`
- **Purpose:** Create/manage `disaster_event` records, including geofence configuration.
- **Data:** `disaster_event`.
- **Primary CTA:** "Buat Event Baru" (create new event).
- **Secondary Actions:** Edit event details/geofence; close an event.
- **Forbidden Actions:** None specific to this screen beyond standard Administrator scope.
- **Loading:** Skeleton list/table.
- **Empty:** Plausible only before the first event is seeded — genuinely empty state with a clear creation CTA.
- **Error:** Save failure (e.g., invalid geofence geometry) → inline validation error.
- **Permission:** System Administrator role required.
- **Offline Behavior:** Requires connectivity.
- **Responsive Hierarchy:**
  - Desktop: table list + a map-based geofence editor panel for the selected event.
  - Tablet: stacked, geofence editor as a full-width panel below the list.
  - Mobile: list first, geofence editing likely simplified (e.g., radius-based rather than freeform polygon drawing) given the smaller viewport.

### Aturan Eskalasi (Escalation Rules)

- **Role:** System Administrator.
- **Route:** `/admin/eskalasi`
- **Purpose:** Configure escalation thresholds/rules — e.g., quality/confidence thresholds that trigger `needs_manual_review` per [STATE_MACHINES.md](STATE_MACHINES.md).
- **Data:** `system_setting` (escalation-rule subset).
- **Primary CTA:** "Simpan Perubahan" (save changes) after adjusting threshold values.
- **Secondary Actions:** Reset to default thresholds.
- **Forbidden Actions:** No ability to disable human verification entirely — thresholds tune when a report is flagged for extra scrutiny, they cannot be set to skip Verifier review altogether, per the non-negotiable "human-in-the-loop" pillar in [PRODUCT_CHARTER.md](PRODUCT_CHARTER.md).
- **Loading:** Skeleton form.
- **Empty:** Not applicable (defaults always populate the form).
- **Error:** Invalid threshold value (e.g., out of valid range) → inline validation error before save is allowed.
- **Permission:** System Administrator role required.
- **Offline Behavior:** Requires connectivity.
- **Responsive Hierarchy:**
  - Desktop: form with grouped threshold sliders/inputs, live preview of effect where feasible.
  - Tablet: same form, single column.
  - Mobile: single-column form, grouped into collapsible sections per threshold category.

### Integrasi (Integrations)

- **Role:** System Administrator.
- **Route:** `/admin/integrasi`
- **Purpose:** Configure optional integrations — Gemini advisory toggle per [ADR 0004](../adr/0004-local-ml-primary-gemini-advisory.md), push notification provider, map tile provider credentials.
- **Data:** `system_setting` (integration subset).
- **Primary CTA:** "Simpan Konfigurasi" (save configuration) per integration.
- **Secondary Actions:** Test connection/credentials for a given integration before saving.
- **Forbidden Actions:** Enabling Gemini here only toggles its availability as an advisory feature for Verifiers — this screen has no control that would make Gemini output authoritative or bypass Verifier review; the toggle's label and helper text must state "hanya sebagai referensi tambahan, tidak menggantikan keputusan verifikator" (only as additional reference, does not replace the verifier's decision).
- **Loading:** Skeleton form; connection-test action shows its own inline spinner.
- **Empty:** Not applicable.
- **Error:** Invalid credentials/failed connection test → inline error specific to that integration, not a full-page failure.
- **Permission:** System Administrator role required.
- **Offline Behavior:** Requires connectivity.
- **Responsive Hierarchy:**
  - Desktop: list of integration cards, each expandable to its configuration form.
  - Tablet: same pattern, single column.
  - Mobile: accordion list, one integration expanded at a time.

### Kesehatan Sistem (System Health)

- **Role:** System Administrator.
- **Route:** `/admin/kesehatan`
- **Purpose:** Service health monitoring — `analysis_job` queue depth/status, model registry state; read-only operational visibility plus the one approval action (model promotion) this role retains.
- **Data:** `analysis_job` (status/queue-depth aggregate only, not individual report content), `model_registry_entry`, `model_evaluation` (read).
- **Primary CTA:** "Promosikan Model" (promote model) — visible only when a candidate model has passed the release gate per [SUCCESS_METRICS.md](../product/SUCCESS_METRICS.md); this is the one mutating action on this screen, and it is a configuration/operations action, not a classification decision.
- **Secondary Actions:** View `apps/ml-api`/`apps/worker` health indicators; view a specific `model_evaluation` report.
- **Forbidden Actions:** No path from this screen to `verification_review` creation or `response_task` creation/assignment — this screen must never expose report-validation or dispatch actions, per the explicit acceptance criterion that Admin cannot validate or dispatch by default.
- **Loading:** Skeleton for health metrics/queue depth chart.
- **Empty:** Not applicable (queue/model-registry state always exists once the system is running).
- **Error:** A degraded/unreachable service (`apps/ml-api` or `apps/worker` per [RISK_REGISTER.md](../product/RISK_REGISTER.md) risk #6) shows a clear status indicator (e.g., red/amber badge) distinct from a page-load error — this screen's entire purpose includes surfacing real degraded states, not hiding them.
- **Permission:** System Administrator role required.
- **Offline Behavior:** Requires connectivity.
- **Responsive Hierarchy:**
  - Desktop: dashboard grid (queue depth chart, service status cards, model registry table).
  - Tablet: stacked panels.
  - Mobile: single-column stacked, model registry as a scrollable list.

### Pengaturan (Settings)

- **Role:** System Administrator.
- **Route:** `/admin/pengaturan`
- **Purpose:** General configuration — retention policy, other thresholds not covered by Aturan Eskalasi/Integrasi.
- **Data:** `system_setting` (general subset).
- **Primary CTA:** "Simpan Pengaturan" (save settings).
- **Secondary Actions:** View current retention policy's effect summary (e.g., "foto akan dihapus setelah X hari" — photos will be deleted after X days) before saving a change.
- **Forbidden Actions:** None specific beyond standard Administrator scope; retention changes never retroactively delete data already outside the new policy window without a clear, separate confirmation step (avoiding accidental mass deletion).
- **Loading:** Skeleton form.
- **Empty:** Not applicable (defaults always populate).
- **Error:** Invalid input → inline validation error.
- **Permission:** System Administrator role required.
- **Offline Behavior:** Requires connectivity.
- **Responsive Hierarchy:**
  - Desktop: grouped form sections, single column, generous width.
  - Tablet: same, narrower.
  - Mobile: single-column form, collapsible sections.

### Profil (Administrator)

Shared structure — see [Shared Profil Pattern](#shared-profil-pattern-all-roles).

---

## Auditor Screens

All Auditor screens share one hard rule: **zero mutating affordances anywhere** — no button, form, or control on any Auditor screen may create, update, delete, approve, assign, or configure anything, per [RBAC_MATRIX.md](../product/RBAC_MATRIX.md) and the acceptance criterion that Auditor is read-only.

### Audit Trail

- **Role:** Auditor.
- **Route:** `/auditor/jejak-audit`
- **Purpose:** Full, unfiltered lineage view — report → analysis → verification → dispatch, per entity or globally.
- **Data:** `audit_event` (full, unscoped).
- **Primary CTA:** None (this is a browsing/inspection screen) — "Lihat Detail" (view detail) to expand a specific event's full `detail` payload is the closest thing to an action, and it is still read-only.
- **Secondary Actions:** Filter by entity type, actor, date range, action type; search by entity ID.
- **Forbidden Actions:** No edit/delete of any `audit_event` — there is no delete icon, no edit form, anywhere on this screen, by design (matches the database-level insert-only enforcement in [THREAT_MODEL.md](../security/THREAT_MODEL.md) threat #12).
- **Loading:** Skeleton table/timeline.
- **Empty:** Implausible in a running system with any activity; if genuinely empty (brand-new org), show "Belum ada aktivitas tercatat" (no recorded activity yet).
- **Error:** Fetch failure → retry.
- **Permission:** Auditor role required; also readable in an operational subset by System Administrator, but this specific screen (full unscoped view) is Auditor-only per [RBAC_MATRIX.md](../product/RBAC_MATRIX.md).
- **Offline Behavior:** Requires connectivity.
- **Responsive Hierarchy:**
  - Desktop: dense table/timeline with filter sidebar.
  - Tablet: table with filters as a collapsible drawer.
  - Mobile: timeline/card list, filters in a bottom sheet.

### Laporan Read-Only (Read-Only Report Browser)

- **Role:** Auditor.
- **Route:** `/auditor/laporan`
- **Purpose:** Browse all reports and their full detail (evidence, predictions, reviews) without any action affordances — the Auditor's equivalent of the Verifier's detail screen, stripped of every decision control.
- **Data:** `report`, `report_evidence`, `geolocation_observation`, `model_prediction`, `model_explanation`, `verification_review` (all, full detail).
- **Primary CTA:** None.
- **Secondary Actions:** Filter/search by status, event, date, reporter, verifier.
- **Forbidden Actions:** No confirm/override/reject/request-info/escalate controls — visually, this screen must not resemble the Verifier decision screen closely enough to invite confusion; it should read clearly as an inspection view (e.g., a distinct "Mode Audit — Hanya Baca" (Audit Mode — Read Only) banner).
- **Loading:** Skeleton list/detail.
- **Empty:** Implausible; same pattern as other list screens if genuinely empty.
- **Error:** Fetch failure → retry.
- **Permission:** Auditor role required.
- **Offline Behavior:** Requires connectivity.
- **Responsive Hierarchy:**
  - Desktop: list + detail split view.
  - Tablet: list navigates to a full-width detail view.
  - Mobile: list navigates to a full-screen detail view.

### Model Registry

- **Role:** Auditor.
- **Route:** `/auditor/model-registry`
- **Purpose:** View model version history and promotion history.
- **Data:** `model_registry_entry` (full history, including non-promoted candidates).
- **Primary CTA:** None; "Lihat Evaluasi" (view evaluation) links to the corresponding Evaluasi Model entry.
- **Secondary Actions:** Filter by active/inactive, by promotion status.
- **Forbidden Actions:** No promote/demote action (that's System Administrator's Kesehatan Sistem screen) — this screen only ever displays history.
- **Loading:** Skeleton table.
- **Empty:** Plausible before any model has been trained/registered — "Belum ada model terdaftar" (no models registered yet).
- **Error:** Fetch failure → retry.
- **Permission:** Auditor role required (also readable by Verifier in a lighter form per [RBAC_MATRIX.md](../product/RBAC_MATRIX.md), but this full-history screen is the Auditor's dedicated view).
- **Offline Behavior:** Requires connectivity.
- **Responsive Hierarchy:**
  - Desktop: table with version, trained/promoted dates, active flag.
  - Tablet: condensed table.
  - Mobile: card list, one model version per card.

### Evaluasi Model (Model Evaluations)

- **Role:** Auditor.
- **Route:** `/auditor/evaluasi-model`
- **Purpose:** View evaluation reports backing each model version — macro-F1, destroyed recall, calibration error, dataset identity, per the [release gate](../product/SUCCESS_METRICS.md#release-gate).
- **Data:** `model_evaluation`.
- **Primary CTA:** None; "Buka Laporan Lengkap" (open full report) may link to the checked-in `ml/reports/` document if rendering the full report inline isn't feasible.
- **Secondary Actions:** Compare two evaluations side-by-side (e.g., before/after a retrain).
- **Forbidden Actions:** No ability to edit or annotate an evaluation record — it is a historical, immutable artifact.
- **Loading:** Skeleton table/detail.
- **Empty:** Plausible before the first model evaluation exists — "Belum ada evaluasi model" (no model evaluations yet); this must never be filled with placeholder/fabricated metrics, per [AGENTS.md](../../AGENTS.md) ML honesty rules — an empty state here is more honest than a fake chart.
- **Error:** Fetch failure → retry.
- **Permission:** Auditor role required.
- **Offline Behavior:** Requires connectivity.
- **Responsive Hierarchy:**
  - Desktop: table + detail panel showing metric breakdown and dataset identity.
  - Tablet: stacked, detail below table.
  - Mobile: list navigates to a full-screen detail view per evaluation.

### Export Compliance

- **Role:** Auditor.
- **Route:** `/auditor/ekspor-kepatuhan`
- **Purpose:** Generate/download compliance-oriented exports and view history of all `export_job` records across the org (not just their own, unlike Coordinator's scoped view).
- **Data:** `export_job` (all, org-wide).
- **Primary CTA:** "Buat Ekspor Kepatuhan" (create compliance export) — itself a read/package action, not a mutation of underlying data.
- **Secondary Actions:** Download a completed export; filter export history by requester, event, date.
- **Forbidden Actions:** No ability to modify or delete an existing `export_job` record, including ones created by a Coordinator — Auditor's export action here is additive (a new export_job) and read-only over history, never a mutation of another role's prior export.
- **Loading:** Skeleton history list; in-progress export shows status.
- **Empty:** "Belum ada ekspor" if genuinely none exist yet.
- **Error:** Export generation failure → explicit error with retry.
- **Permission:** Auditor role required.
- **Offline Behavior:** Requires connectivity.
- **Responsive Hierarchy:**
  - Desktop: form panel + full org-wide history table.
  - Tablet: stacked.
  - Mobile: stacked, form as a modal/step, history as a simple list.

### Retensi Data (Data Retention)

- **Role:** Auditor.
- **Route:** `/auditor/retensi-data`
- **Purpose:** View retention policy configuration and evidence lifecycle status — what's scheduled for archival/deletion and when — visibility only.
- **Data:** `system_setting` (retention subset, read), `report` (archival status).
- **Primary CTA:** None.
- **Secondary Actions:** Filter by upcoming archival date, by event.
- **Forbidden Actions:** No control to change retention policy — that is exclusively System Administrator's "Pengaturan" screen; this screen has no save/edit affordance of any kind.
- **Loading:** Skeleton list.
- **Empty:** Plausible if no retention policy has triggered any pending archival yet — "Tidak ada item yang dijadwalkan untuk arsip saat ini" (no items currently scheduled for archival).
- **Error:** Fetch failure → retry.
- **Permission:** Auditor role required.
- **Offline Behavior:** Requires connectivity.
- **Responsive Hierarchy:**
  - Desktop: table showing policy summary + upcoming archival list.
  - Tablet: stacked.
  - Mobile: stacked, policy summary as a card, list below.

### Profil (Auditor)

Shared structure — see [Shared Profil Pattern](#shared-profil-pattern-all-roles).

---

## Shared Pattern Screens

### Shared Profil Pattern (All Roles)

- **Role:** All five roles (Reporter, Verifier, Response Coordinator, System Administrator, Auditor) — one per role, scoped to the user's own record.
- **Route:** `/{role-prefix}/profil` (e.g., `/pelapor/profil`, `/verifikator/profil`, `/koordinator/profil`, `/admin/profil`, `/auditor/profil`).
- **Purpose:** View/edit own `profile` fields (display name, phone, notification preferences); view own role label(s).
- **Data:** `profile` (own), `role_assignment` (own, read-only display of current role(s)).
- **Primary CTA:** "Simpan Perubahan" (save changes) after editing an editable field.
- **Secondary Actions:** "Keluar" (log out); change password (redirects to a Supabase Auth-backed flow).
- **Forbidden Actions:** No self-service role change — role display is read-only everywhere except the System Administrator's "Pengguna & Role" screen, which manages *other* users' roles, never a self-elevation path.
- **Loading:** Skeleton form.
- **Empty:** Not applicable (a profile always exists once authenticated).
- **Error:** Save failure → inline error, form retains unsaved input rather than clearing it.
- **Permission:** Each role's own profile, RLS-scoped to `profile.user_id = self`.
- **Offline Behavior:** Reporter's Profil should render from cache if offline (read-only view acceptable offline; save requires connectivity). Other roles' Profil requires connectivity consistent with their non-offline-first work pattern.
- **Responsive Hierarchy:**
  - Desktop: centered form, moderate width, with role/account info in a sidebar-style panel.
  - Tablet: single column, same content stacked.
  - Mobile: single-column full-width form.

### Shared Notifikasi Pattern (Verifier, Coordinator)

- **Role:** Verifier (`/verifikator/notifikasi`), Response Coordinator (`/koordinator/notifikasi`).
- **Purpose:** Own notifications — new queue items, information-request responses (Verifier); new verified incidents, task updates (Coordinator).
- **Data:** `notification` (own).
- **Primary CTA:** Tap a notification → navigate to its related entity (a queue item, a task, etc.).
- **Secondary Actions:** Mark as read; mark all as read; (Enhanced Demo tier) manage push notification preferences, linking to `push_subscription`.
- **Forbidden Actions:** No action can be taken on the underlying entity from within the notification itself beyond navigation — e.g., a Verifier cannot confirm a report directly from a notification toast, ensuring every decision still passes through its full detail screen.
- **Loading:** Skeleton list.
- **Empty:** "Tidak ada notifikasi" (no notifications) — positive state.
- **Error:** Fetch failure → retry.
- **Permission:** Role required per route; RLS scopes to `recipient_profile_id = self`.
- **Offline Behavior:** Requires connectivity for live notifications; last-fetched notifications may render from cache with a staleness indicator.
- **Responsive Hierarchy:**
  - Desktop: list panel, can be a dropdown from the top bar or a full page.
  - Tablet: full-page list.
  - Mobile: full-page list, swipe-to-mark-read gesture optional.

---

## System-State / Cross-Cutting Screens

### PWA Install Prompt

- **Role:** Any authenticated role (most relevant to Reporter, given field/mobile use).
- **Route:** Not a distinct route — an overlay/banner triggered by the `beforeinstallprompt` event or an in-app "Instal Aplikasi" prompt.
- **Purpose:** Encourage installing MBOYO as a PWA for a more reliable offline experience (persistent icon, better storage persistence odds per [RISK_REGISTER.md](../product/RISK_REGISTER.md) risk #2).
- **Data:** None.
- **Primary CTA:** "Instal Aplikasi" (install app).
- **Secondary Actions:** "Nanti saja" (maybe later) — dismiss without disabling future prompts entirely, subject to platform-level prompt-frequency limits.
- **Forbidden Actions:** Must never block access to the app underneath it — always dismissible, never a hard gate.
- **Loading:** Not applicable (instant, browser-native prompt or a lightweight custom banner).
- **Empty:** Not applicable.
- **Error:** If install fails (rare, platform-level), a toast explains it didn't succeed; the app remains fully usable in-browser regardless.
- **Permission:** Any authenticated role; most emphasized for Reporter.
- **Offline Behavior:** The prompt itself and the install action work regardless of connectivity, since it's a browser/OS-level capability.
- **Responsive Hierarchy:**
  - Desktop: small corner banner or browser-native install icon in the address bar.
  - Tablet: banner, similar to mobile.
  - Mobile: bottom banner or bottom sheet, most prominent here given mobile is the primary Reporter form factor.

### PWA Update-Available Prompt

- **Role:** Any authenticated role.
- **Route:** Not a distinct route — an overlay/toast triggered when a new service worker version is waiting to activate.
- **Purpose:** Let the user apply an available app update without losing in-progress work.
- **Data:** None.
- **Primary CTA:** "Perbarui Sekarang" (update now) — triggers `skipWaiting`/reload.
- **Secondary Actions:** "Nanti" (later) — defers, update applies on next natural reload.
- **Forbidden Actions:** Must never force-reload while a Reporter has an unsaved/in-progress report in the wizard — the prompt should defer or warn explicitly if this is detected, since forcing a reload mid-capture would contradict the offline-first reliability guarantee.
- **Loading:** Not applicable.
- **Empty:** Not applicable.
- **Error:** If update fails to apply, the app continues running the current version with a toast explaining the update will retry later.
- **Permission:** Any authenticated role.
- **Offline Behavior:** Update application itself may require connectivity to fetch new assets, though the prompt can appear based on a service worker check that occurred while online.
- **Responsive Hierarchy:**
  - Desktop: small toast/banner, non-modal.
  - Tablet: same, non-modal banner.
  - Mobile: bottom toast/banner, non-modal, dismissible.

### Global Offline Banner

- **Role:** All roles.
- **Route:** Not a distinct route — a persistent banner/indicator rendered across the app shell whenever `navigator.onLine` is false or a fetch has failed due to connectivity.
- **Purpose:** Give every role a constant, honest signal of connectivity state — critical given how differently each role's screens behave offline (Reporter's screens work fully; Verifier/Coordinator/Admin/Auditor screens are connectivity-dependent).
- **Data:** Client-side connectivity state only.
- **Primary CTA:** None (informational).
- **Secondary Actions:** For Reporter specifically, a link to "Antrean Offline" if there are pending items.
- **Forbidden Actions:** Must never claim "online" when a request has actually failed (e.g., a flaky connection reporting `navigator.onLine = true` while requests time out) — the banner's logic should reflect actual request success/failure, not just the browser's connectivity flag, to avoid a misleading "no problem" state.
- **Loading:** Not applicable.
- **Empty:** Not applicable (banner simply doesn't render when online and healthy).
- **Error:** This banner *is* the error/degraded-state indicator for connectivity; it does not have its own separate error state.
- **Permission:** All roles.
- **Offline Behavior:** This is the offline-behavior indicator itself.
- **Responsive Hierarchy:**
  - Desktop: slim top banner, non-blocking.
  - Tablet: same, slim top banner.
  - Mobile: slim top banner or a persistent small icon in the top bar if screen space is tight.

### Session Expired / Re-authenticate

- **Role:** Any authenticated role.
- **Route:** Triggered inline (no dedicated route; intercepts the current route) when a session token expires or is invalidated.
- **Purpose:** Prompt re-authentication without losing in-progress context where possible.
- **Data:** None persisted; may hold in-memory the user's current route to return to post-login.
- **Primary CTA:** "Masuk Kembali" (log back in) — reuses the Login screen/component, potentially as a modal overlay rather than a full navigation away.
- **Secondary Actions:** None.
- **Forbidden Actions:** Must never discard a Reporter's in-progress local report draft — since drafts live in IndexedDB independent of session state, a session expiry must not trigger any data loss; the Reporter should be able to re-authenticate and resume exactly where they were.
- **Loading:** Standard login-submission loading state.
- **Empty:** Not applicable.
- **Error:** Same error patterns as Login (invalid credentials, network failure).
- **Permission:** Applies whenever any authenticated route detects an invalid/expired session.
- **Offline Behavior:** Re-authentication requires connectivity; if a session expires while the Reporter is offline mid-wizard, the wizard must continue to function locally (auth is not required for local-only draft creation) and only prompt re-auth at the point an actual server call (sync) is attempted.
- **Responsive Hierarchy:** Same as Login (centered modal/card on desktop and tablet, full-screen on mobile).

### Unauthorized (403 — Role Mismatch)

- **Role:** Any authenticated role attempting to access a route outside their role's allowance.
- **Route:** Rendered in place of any route the user's role doesn't permit (e.g., a Reporter navigating directly to a Verifier URL).
- **Purpose:** Clearly communicate the access restriction without leaking information about what exists at that route.
- **Data:** None.
- **Primary CTA:** "Kembali ke Beranda" (return to home) — routes to that role's own default landing screen.
- **Secondary Actions:** None.
- **Forbidden Actions:** Must never reveal entity data, counts, or any hint of what the restricted screen would have shown — a generic message only ("Anda tidak memiliki akses ke halaman ini" — you do not have access to this page).
- **Loading:** Not applicable (this is itself a terminal state).
- **Empty:** Not applicable.
- **Error:** This screen is itself the error state for authorization failures.
- **Permission:** Rendered specifically because permission was denied — the screen itself requires no permission to view.
- **Offline Behavior:** This is a client-side route-guard state; it can render offline based on cached role information, though a true server-side RLS denial would only surface when a request is actually attempted online.
- **Responsive Hierarchy:** Simple centered message + illustration at all breakpoints — desktop/tablet slightly larger illustration, mobile more compact.

### Not Found (404)

- **Role:** All roles / public.
- **Route:** Any unmatched route.
- **Purpose:** Standard not-found handling.
- **Data:** None.
- **Primary CTA:** "Kembali ke Beranda" (return to home) — routes to the role's default landing screen, or the public landing page if unauthenticated.
- **Secondary Actions:** None.
- **Forbidden Actions:** None.
- **Loading:** Not applicable.
- **Empty:** Not applicable.
- **Error:** This screen is itself the error/terminal state.
- **Permission:** Public (renders regardless of auth state).
- **Offline Behavior:** Precached, renders offline.
- **Responsive Hierarchy:** Simple centered message + illustration at all breakpoints.

### Generic Error (500 / Unhandled)

- **Role:** All roles / public.
- **Route:** Rendered in place of any screen when an unhandled error occurs.
- **Purpose:** Fail gracefully and honestly rather than showing a blank screen or a stack trace to the end user.
- **Data:** None (must not leak internal error detail/stack traces to non-developer users; a correlation/error ID may be shown for support purposes, tying to the structured logging in [PRODUCTION_SCOPE.md](../product/PRODUCTION_SCOPE.md)).
- **Primary CTA:** "Muat Ulang" (reload) or "Kembali ke Beranda" (return to home).
- **Secondary Actions:** "Laporkan Masalah" (report the issue) — a lightweight feedback link, not a full support ticket system.
- **Forbidden Actions:** Must never silently retry an action that could cause a duplicate mutation (e.g., must not blindly resubmit a form on reload without user confirmation) — ties to the idempotency discipline in [SEQUENCE_FLOWS.md](../architecture/SEQUENCE_FLOWS.md).
- **Loading:** Not applicable (this is itself a terminal state, though a reload action shows its own loading indicator).
- **Empty:** Not applicable.
- **Error:** This screen is itself the error state.
- **Permission:** Renders regardless of role/auth state, since the underlying error may have occurred before role could even be determined.
- **Offline Behavior:** If the error itself is due to lost connectivity, this screen should ideally be distinguished from a true application error — where feasible, a connectivity-caused failure should route to the Global Offline Banner pattern instead of this generic error screen, since conflating the two would misrepresent a normal offline state as a system fault.
- **Responsive Hierarchy:** Simple centered message + illustration at all breakpoints.

### Maintenance Mode

- **Role:** All roles / public.
- **Route:** Rendered in place of the entire app when a maintenance flag is active (System Administrator-controlled, via `system_setting`).
- **Purpose:** Communicate planned downtime rather than presenting as a broken app.
- **Data:** `system_setting` (maintenance flag/message, read).
- **Primary CTA:** None (informational) — an estimated return time if configured.
- **Secondary Actions:** None.
- **Forbidden Actions:** Must never block a Reporter's ability to create/queue a report locally — per the offline-first invariant, report creation has zero live-network dependency, so maintenance mode (a server-side condition) should not prevent the Reporter app shell itself from loading if it's already installed/cached; it primarily blocks server-dependent actions (sync, verification, dispatch, admin, audit) while leaving local capture available.
- **Loading:** Not applicable.
- **Empty:** Not applicable.
- **Error:** This screen is itself a deliberately-triggered state, not an error, and should be visually distinct from the Generic Error screen (calmer tone, explains it's planned).
- **Permission:** Renders for all roles when the maintenance flag is active, with the Reporter-specific carve-out noted above.
- **Offline Behavior:** An already-installed PWA should still allow local report drafting even while the server reports maintenance mode, consistent with offline-first invariants.
- **Responsive Hierarchy:** Simple centered message + illustration at all breakpoints.
