# MBOYO — Production-Ready Claude Code Build Blocks

> **Product:** MBOYO  
> **Domain:** Offline-first disaster reporting, computer vision, geospatial command, human verification, and response coordination  
> **Target:** PIDI Digdaya × Hackathon Bank Indonesia 2026 capstone / Top 80 readiness  
> **Goal:** Production-minded architecture with a deterministic live-demo mode.

---

# How to Use

Do not paste all blocks at once.

1. Run **BLOCK 00–04** to lock product, architecture, RBAC, and information architecture.
2. Generate and approve the Google Stitch designs.
3. Continue with **BLOCK 05 onward** sequentially.
4. After every block, run verification, inspect the diff, and commit using the supplied semantic commit message.
5. When acceptance criteria fail, send Claude Code:  
   `Fix only the failing acceptance criteria from the previous block. Do not begin the next block.`

## Global Rules for Every Block

- Read `AGENTS.md`, relevant documentation, repository files, manifests, and lockfiles before editing.
- For Next.js APIs, inspect the relevant local documentation under `node_modules/next/dist/docs/` because installed APIs and conventions may differ from prior knowledge.
- Preserve existing correct work; do not rewrite blindly.
- Keep every block runnable and independently reviewable.
- Use TypeScript strict mode and Python type hints.
- Do not hide errors with `any`, disabled lint rules, fake responses, or fabricated metrics.
- Never commit `.env`, credentials, private keys, service-role keys, raw sensitive evidence, or generated secrets.
- User-facing copy must use Bahasa Indonesia.
- Every demo fallback must be visibly and technically labeled.
- Never describe ML accuracy as guaranteed. Accuracy must be measured on an untouched test set.
- End each block with: summary, changed files, verification results, limitations, and next block.

---

# Product and Roles

MBOYO tagline: **“Laporan Tetap Jalan. Respons Lebih Tepat.”**

## Reporter

Owns report creation and own-report follow-up.

Allowed:
- Create and save reports.
- Capture/select photo and GPS.
- Submit offline.
- Inspect own queue and own reports.
- Respond to information requests.

Forbidden:
- View private reports from others.
- Validate AI.
- Set response priority.
- Dispatch tasks.
- Configure the system.

## Verifier

Owns evidence and classification decisions.

Allowed:
- Inspect evidence, quality, duplicates, location confidence, model probabilities, and explanations.
- Confirm, override, reject, request information, or escalate for senior review.

Forbidden:
- Dispatch resources.
- Change operational priority.
- Manage roles/settings.
- Delete audit history.

## Response Coordinator

Owns verified operational response.

Allowed:
- View verified/escalated incidents.
- Set operational priority.
- Group incidents.
- Create, assign, and track response tasks.
- Export operational data.

Forbidden:
- Change original evidence.
- Change verifier decisions or model probabilities.
- Manage users/settings.

## System Administrator

Owns platform configuration.

Allowed:
- Manage users, role assignments, events, integrations, thresholds, retention, and service health.

Forbidden by default:
- Validate reports.
- Dispatch response tasks.
- Edit or delete audit events.

## Auditor

Strictly read-only.

Allowed:
- Read audit lineage, reports, model registry, evaluations, external advisory usage, exports, and retention evidence.

Forbidden:
- Any mutation.

---

# Recommended Architecture

```text
mboyo/
├─ AGENTS.md
├─ README.md
├─ package.json
├─ pnpm-workspace.yaml
├─ turbo.json
├─ .env.example
├─ docker-compose.yml
├─ apps/
│  ├─ web/                 # Next.js App Router PWA and BFF
│  ├─ ml-api/              # FastAPI model API
│  └─ worker/              # Python job worker
├─ packages/
│  ├─ ui/
│  ├─ domain/
│  ├─ api-client/
│  ├─ config-eslint/
│  └─ config-typescript/
├─ supabase/
│  ├─ migrations/
│  ├─ policies/
│  ├─ functions/
│  └─ seed.sql
├─ ml/
│  ├─ data/{raw,interim,processed,manifests}/
│  ├─ configs/
│  ├─ src/
│  ├─ models/
│  ├─ reports/
│  └─ tests/
├─ infra/
├─ scripts/
└─ docs/
```

## Stack

- Next.js App Router, React, TypeScript strict.
- Tailwind CSS and accessible Radix/shadcn foundations.
- TanStack Query, React Hook Form, Zod, limited Zustand.
- Dexie IndexedDB.
- Workbox-based service worker and Background Sync.
- MapLibre GL JS.
- Recharts.
- Supabase Auth, PostgreSQL, PostGIS, Storage, Realtime, and RLS.
- FastAPI, PyTorch, torchvision, OpenCV, Pillow, scikit-learn, ONNX Runtime.
- Database-backed `analysis_jobs` consumed by a dedicated worker.
- Optional Gemini advisory, never authoritative.

---

# Brand Tokens

```text
Primary Ink Navy  #082032
Deep Ocean        #0B3A53
Signal Cyan       #18B6C9
Relief Teal       #1F9D8B
Safe Green        #2EAD68
Caution Amber     #F6B73C
Priority Orange   #F47A38
Critical Red      #D83A3A
Cloud White       #F7FAFC
Mist              #E8F0F4
Slate             #334155
Muted             #64748B
Night             #06141F
Border            #D7E3E9
```

Severity:

```text
unknown           #64748B
no_damage         #2EAD68
minor_damage      #F6B73C
major_damage      #F47A38
destroyed         #D83A3A
```

Typography:
- Plus Jakarta Sans for UI.
- IBM Plex Mono for IDs, coordinates, model versions, and metrics.

---

# Environment Variables

## Required production-like variables

```env
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
SUPABASE_REPORTS_BUCKET=report-evidence
SUPABASE_EXPORTS_BUCKET=generated-exports
ML_API_URL=http://localhost:8000
ML_INTERNAL_TOKEN=
NEXT_PUBLIC_MAP_STYLE_URL=
MAPTILER_API_KEY=
SESSION_SIGNING_SECRET=
CRON_SECRET=
```

## Optional integrations

```env
GEMINI_API_KEY=
GEMINI_MODEL=
GEMINI_FALLBACK_ENABLED=false
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:team@example.com
RESEND_API_KEY=
EMAIL_FROM=
DEMO_MODE=true
NEXT_PUBLIC_DEMO_MODE=true
```

Never expose service-role, Gemini, ML internal token, VAPID private key, or signing secrets to browser code.

---

# BLOCK 00 — Repository Audit and Engineering Contract

## Prompt

```text
You are the principal engineer for MBOYO.

Before changing anything:
1. Inspect the complete repository tree.
2. Read package manifests, lockfiles, existing docs, framework versions, and AGENTS.md.
3. For Next.js behavior, read relevant local guides under node_modules/next/dist/docs/.
4. Report what exists, what is reusable, conflicts, technical debt, and missing foundations.

Create or update AGENTS.md with:
- MBOYO identity and mission.
- Architecture boundaries.
- Non-overlapping RBAC for Reporter, Verifier, Response Coordinator, System Administrator, and Auditor.
- Next.js local-doc rule.
- TypeScript and Python standards.
- Offline-first invariants.
- ML honesty and evaluation rules.
- secret/security rules.
- semantic commit format.
- requirement that demo fallbacks be disclosed.
- final agent response format.

Create docs/product/WORKING_CONTRACT.md:
- mission,
- non-goals,
- definition of done,
- demo-mode policy,
- production-mode policy,
- never-fake checklist,
- decision log format.

Do not implement application code.

Acceptance:
- Repository state is documented.
- Role boundaries are explicit.
- Only documentation changes.
- Show git diff and verification.
```

## Commit

```text
docs(project): define mboyo engineering contract and agent rules
```

---

# BLOCK 01 — Product Charter, Scope, Metrics, and Roadmap

## Prompt

```text
Read AGENTS.md and WORKING_CONTRACT.md.

Create:
- docs/product/PRODUCT_CHARTER.md
- docs/product/MVP_SCOPE.md
- docs/product/PRODUCTION_SCOPE.md
- docs/product/SUCCESS_METRICS.md
- docs/product/DELIVERY_ROADMAP.md
- docs/product/RISK_REGISTER.md

The MVP live flow must be:
Reporter login → create photo/GPS report → go offline → submit → queue persists after reload → reconnect → automatic idempotent sync → analysis job → verifier sees probabilities/quality/GPS → verifier confirms or overrides → coordinator sees verified incident → coordinator creates response task → escalation appears → analytics/export update → auditor sees complete lineage.

Define MVP, enhanced demo, production, and future tiers.

Metrics:
- report completion rate,
- offline queue success,
- duplicate prevention,
- sync latency,
- verification SLA,
- task SLA,
- macro-F1,
- destroyed recall,
- calibration error,
- abstention rate,
- CPU p95 inference latency,
- accessibility,
- web performance,
- demo reliability.

Never promise fixed accuracy before evaluation. Define a release gate and an advisory-only fallback if gates fail.

Risk register must cover network, browser storage, GPS denial/spoofing, poor image quality, model bias, service outage, map outage, Supabase outage, external Gemini risk, sensitive imagery, and demo failure.

No app code.
```

## Commit

```text
docs(product): add mboyo charter scope metrics and roadmap
```

---

# BLOCK 02 — Architecture, ADRs, Sequences, and Threat Model

## Prompt

```text
Read all product docs.

Create:
- docs/architecture/SYSTEM_ARCHITECTURE.md
- docs/architecture/SEQUENCE_FLOWS.md
- docs/architecture/DEPLOYMENT_TOPOLOGY.md
- docs/security/THREAT_MODEL.md
- docs/adr/0001-monorepo.md
- docs/adr/0002-supabase-platform.md
- docs/adr/0003-database-job-queue.md
- docs/adr/0004-local-ml-primary-gemini-advisory.md
- docs/adr/0005-offline-indexeddb-workbox.md

Architecture:
- pnpm/Turborepo.
- apps/web, apps/ml-api, apps/worker.
- packages/ui, domain, api-client.
- Supabase Auth/Postgres/PostGIS/Storage/Realtime.
- private evidence bucket.
- analysis_jobs database queue.
- worker safe job claiming.
- BFF mediates browser/server trust.
- deterministic demo mode.

Create Mermaid diagrams:
1. Components.
2. Online report.
3. Offline replay.
4. Analysis job.
5. Verification to response task.
6. Deployment.

Threat model:
- fake reports,
- replay/duplicates,
- GPS spoofing,
- broken access control,
- signed URL leakage,
- service-role exposure,
- malicious files,
- Gemini prompt injection,
- sensitive imagery,
- offline device exposure,
- rate abuse,
- audit tampering.

For each: asset, attacker, likelihood, impact, prevention, detection, recovery, residual limitation.

Document Gemini as explicit opt-in external advisory only.
```

## Commit

```text
docs(architecture): define mboyo topology decisions and threat model
```

---

# BLOCK 03 — Domain Model, State Machines, RBAC, and Navigation

## Prompt

```text
Create:
- docs/product/DOMAIN_MODEL.md
- docs/product/RBAC_MATRIX.md
- docs/product/STATE_MACHINES.md
- docs/product/NAVIGATION_BY_ROLE.md

Entities:
organization, profile, role_assignment, disaster_event, report, report_evidence, geolocation_observation, analysis_job, model_prediction, model_explanation, verification_review, incident_cluster, cluster_member, response_task, task_assignment, notification, push_subscription, export_job, audit_event, system_setting, model_registry_entry, model_evaluation.

Report states:
draft_local, queued_offline, syncing, submitted, evidence_uploaded, analysis_queued, analysis_running, analysis_completed, needs_manual_review, verified, rejected, archived.

Priority:
unassigned, low, medium, high, critical.

Task states:
draft, assigned, acknowledged, in_progress, blocked, completed, cancelled.

Define valid transitions, actor, preconditions, transaction result, and audit action.

Create an entity/action matrix for create/read/update/delete/approve/export/assign/configure.

Navigation:
Reporter: Beranda, Buat Laporan, Antrean Offline, Laporan Saya, Bantuan, Profil.
Verifier: Ringkasan, Antrean Verifikasi, Peta Bukti, Semua Laporan, Permintaan Informasi, Notifikasi, Profil.
Coordinator: Command Center, Peta Krisis, Prioritas, Tugas Respons, Analitik, Ekspor, Notifikasi, Profil.
Admin: Administrasi, Pengguna & Role, Event Bencana, Aturan Eskalasi, Integrasi, Kesehatan Sistem, Pengaturan, Profil.
Auditor: Audit Trail, Laporan Read-Only, Model Registry, Evaluasi Model, Export Compliance, Retensi Data, Profil.

Acceptance:
- Mutation ownership never overlaps accidentally.
- Auditor is read-only.
- Admin cannot validate or dispatch by default.
```

## Commit

```text
docs(domain): define mboyo entities state machines and rbac
```

---

# BLOCK 04 — Information Architecture and Stitch Handoff

## Prompt

```text
Read the domain, RBAC, and navigation docs.

Create:
- docs/product/INFORMATION_ARCHITECTURE.md
- docs/product/SCREEN_INVENTORY.md
- docs/product/CONTENT_GUIDE.md
- docs/product/STITCH_HANDOFF.md

Inventory every public, Reporter, Verifier, Coordinator, Admin, Auditor, and system-state screen.

For every screen define:
- role,
- route,
- purpose,
- data,
- primary CTA,
- secondary actions,
- forbidden actions,
- loading,
- empty,
- error,
- permission,
- offline behavior,
- desktop/tablet/mobile hierarchy.

Include public landing/header/hero/footer, auth, report wizard, queue, own-report detail, verifier queue/detail, command map, clusters, tasks, analytics, exports, admin, audit, model governance, PWA install/update, and all edge states.

Do not implement screens. This is the Google Stitch source of truth.
```

## Commit

```text
docs(ux): define mboyo information architecture and stitch handoff
```

---

# DESIGN CHECKPOINT

Run Google Stitch now. Approve brand, component library, reporter mobile flow, verifier detail, coordinator desktop command center, admin, auditor, system states, and complete prototype. Save references under `docs/design-reference/` before coding UI.

---

# BLOCK 05 — Production Monorepo Bootstrap

## Prompt

```text
Read AGENTS.md and all ADRs.

Bootstrap/refactor a pnpm + Turborepo monorepo:
apps/web, apps/ml-api, apps/worker, packages/ui, packages/domain, packages/api-client, packages/config-eslint, packages/config-typescript, supabase, ml, infra, scripts, docs.

Requirements:
- latest stable compatible Next.js App Router,
- TypeScript strict,
- Python 3.12,
- consistent formatting/linting,
- shared environment validation,
- no secrets,
- Docker Compose skeleton,
- health endpoints for web and ML API,
- worker heartbeat placeholder.

Root commands:
dev, dev:web, dev:ml, dev:worker, lint, typecheck, test, test:e2e, build, format, db:start, db:stop, db:reset, db:types, ml:prepare, ml:train, ml:evaluate, ml:export.

Verification:
pnpm install, lint, typecheck, web build, Python compile/import smoke test.
```

## Commit

```text
chore(repo): bootstrap mboyo production monorepo
```

---

# BLOCK 06 — Design System, Brand Assets, and PWA Manifest

## Prompt

```text
Read approved Stitch references.

Implement packages/ui and brand foundations using the exact MBOYO tokens.

Typography:
Plus Jakarta Sans; IBM Plex Mono for technical values.

Create original:
- logo SVG,
- favicon,
- 192/512 icons,
- apple touch icon,
- maskable icon,
- web manifest,
- OG image.

Create accessible primitives:
Button, Input, Textarea, Select, Checkbox, RadioCard, Dialog, Drawer, Sheet, Toast, Badge, SeverityBadge, StatusBadge, RoleBadge, MetricCard, DataTable, EmptyState, ErrorState, LoadingSkeleton, OnlineStatus, SyncStatus, ConfidenceMeter, ProbabilityBars, Timeline, NotificationCard.

Create /design-system route.

Requirements:
- no duplicated inline severity colors,
- 44px targets,
- focus rings,
- reduced-motion support,
- amber uses readable dark text,
- responsive at 390, 834, 1440.
```

## Commit

```text
feat(ui): add mboyo design system and pwa assets
```

---

# BLOCK 07 — Local Supabase Platform and Environment Validation

## Prompt

```text
Configure Supabase local development:
- config,
- Auth,
- Postgres,
- PostGIS,
- Storage,
- Realtime,
- private report-evidence bucket,
- private generated-exports bucket,
- scripts for start/stop/reset/type generation,
- server-only service-role client,
- browser anon client protected by RLS,
- environment validation in TypeScript and Python.

Create docs/architecture/LOCAL_PLATFORM.md.

Do not implement full schema yet.

Acceptance:
- local platform starts,
- PostGIS exists,
- environment failures are clear,
- server secrets never enter client bundle.
```

## Commit

```text
chore(platform): configure local supabase and environment validation
```

---

# BLOCK 08 — Database, PostGIS, RLS, Realtime, and Seed

## Prompt

```text
Implement Supabase migrations for:
organizations, profiles, role_assignments, disaster_events, reports, report_evidence, geolocation_observations, analysis_jobs, model_predictions, model_explanations, verification_reviews, incident_clusters, cluster_members, response_tasks, task_assignments, notifications, push_subscriptions, export_jobs, audit_events, system_settings, model_registry_entries, model_evaluations.

Requirements:
- UUID keys,
- timestamps,
- archive semantics,
- geography(Point,4326),
- GIST indexes,
- state enums,
- unique client_report_id,
- SHA-256 and perceptual-hash fields,
- probability/confidence checks,
- queue and map indexes,
- immutable audit events,
- realtime publication.

SQL/RPC functions:
- reports_in_bbox,
- reports_within_radius,
- cluster_destroyed_reports,
- claim_analysis_jobs with safe locking,
- append_audit_event,
- permission helpers.

Implement exact RLS from RBAC docs.

Seed one organization, one active event, all demo roles, reports in diverse states, predictions, tasks, notifications, model versions, and audit events.

Add RLS and geospatial tests.
```

## Commit

```text
feat(database): add mboyo postgis schema rls and seed data
```

---

# BLOCK 09 — Authentication and Authorization

## Prompt

```text
Implement Supabase Auth and server-side authorization.

Demo accounts:
reporter@mboyo.demo / DemoMboyo2026!
verifier@mboyo.demo / DemoMboyo2026!
coordinator@mboyo.demo / DemoMboyo2026!
admin@mboyo.demo / DemoMboyo2026!
auditor@mboyo.demo / DemoMboyo2026!

Role destinations:
Reporter /reporter
Verifier /verifier
Coordinator /command
Admin /admin
Auditor /audit

Create server helpers:
getCurrentUser, requireAuthenticated, requireRole, requirePermission.

Requirements:
- server session,
- no localStorage auth token,
- installed Next.js-compatible middleware/proxy pattern,
- server-side route denial,
- demo chooser only in demo mode,
- unauthorized/session-expired screens,
- tests for cross-role denial,
- Auditor cannot mutate,
- Admin cannot validate/dispatch without a separately assigned role.
```

## Commit

```text
feat(auth): implement mboyo sessions demo accounts and rbac guards
```

---

# BLOCK 10 — Public Experience: Navbar, Hero, Footer, and Trust Pages

## Prompt

```text
Implement approved Stitch public designs.

Header:
MBOYO, Solusi, Cara Kerja, Teknologi, Dampak, Keamanan Data, Masuk, CTA Laporkan Kerusakan.

Hero:
“Laporan Tetap Jalan. Respons Lebih Tepat.”
Explain offline photo/GPS reporting, automatic sync, local CV triage, human verification, and command coordination.
CTA Buat Laporan; secondary Lihat Demo Command Center.

Sections:
problem, end-to-end flow, role separation, offline proof, AI+human, geospatial coordination, data sovereignty, metrics, demo accounts, FAQ.

Footer:
product, navigation, technology, privacy, methodology, accessibility, status, team attribution.

Trust pages:
/privacy, /methodology, /data-governance, /accessibility.

Add SEO metadata, sitemap, robots, OG image. Responsive 390/834/1440. No external stock-photo dependency.
```

## Commit

```text
feat(marketing): build mboyo public and trust experience
```

---

# BLOCK 11 — Role-Specific Shells and Navigation

## Prompt

```text
Implement five separate application shells from Stitch.

Shared: topbar, online/offline indicator, notification area, user menu, accessible responsive drawer, breadcrumbs.

Reporter nav:
Beranda, Buat Laporan, Antrean Offline, Laporan Saya, Bantuan, Profil.

Verifier:
Ringkasan, Antrean Verifikasi, Peta Bukti, Semua Laporan, Permintaan Informasi, Notifikasi, Profil.

Coordinator:
Command Center, Peta Krisis, Prioritas, Tugas Respons, Analitik, Ekspor, Notifikasi, Profil.

Admin:
Administrasi, Pengguna & Role, Event Bencana, Aturan Eskalasi, Integrasi, Kesehatan Sistem, Pengaturan, Profil.

Auditor:
Audit Trail, Laporan Read-Only, Model Registry, Evaluasi Model, Export Compliance, Retensi Data, Profil.

Navigation must never expose forbidden actions. Build desktop, tablet, and mobile patterns.
```

## Commit

```text
feat(navigation): add role-specific mboyo application shells
```

---

# BLOCK 12 — Reporter Home and Report Wizard

## Prompt

```text
Build /reporter, /reporter/new, /reporter/reports, /reporter/reports/[id], /reporter/help, /reporter/profile.

New report wizard:
1 Event.
2 Photo capture/gallery.
3 Preview and quality feedback.
4 GPS.
5 Manual map pin/address fallback.
6 Description and observed condition.
7 Consent.
8 Review.
9 Submit or save offline.

Fields:
event, client_report_id, title, description, observed severity, contact preference, photo blob, lat/lng, accuracy, altitude/heading optional, GPS timestamp, location source, consent versions.

UX:
autosave, draft restored, calm Indonesian copy, large controls, sticky mobile CTA, no data loss, explicit GPS accuracy limitation.

Use an offline repository interface that BLOCK 13 will implement. Online mock adapter may be used temporarily but clearly marked.
```

## Commit

```text
feat(reporter): add mobile-first damage report workflow
```

---

# BLOCK 13 — Dexie IndexedDB and Durable Offline Queue

## Prompt

```text
Implement IndexedDB database `mboyo-offline` with Dexie.

Tables:
reportDrafts, reportQueue, evidenceBlobs, syncAttempts, appMetadata.

Queue fields:
id, client_report_id unique, event_id, payload, evidence_blob_id, status pending/syncing/failed/synced/conflict, attempts, last error, next_retry_at, timestamps, server_report_id.

Functions:
saveDraft, restoreDraft, clearDraft, enqueueReport, listQueue, getQueueCounts, claimPendingItems, markSyncing, markSynced, markFailed, markConflict, retryItem, deleteUnsyncedItem, pruneSynced, clear evidence after confirmed upload.

Requirements:
- native Blob,
- single-flight lock,
- idempotency,
- exponential backoff with jitter,
- permanent vs retryable errors,
- preserve failed data,
- quota handling,
- storage estimate,
- persistence after browser restart,
- manual retry,
- delayed cleanup after sync.

Build /reporter/offline.

Test with fake-indexeddb for persistence, blobs, duplicates, retry, conflict, and cleanup.
```

## Commit

```text
feat(offline): implement durable indexeddb report queue
```

---

# BLOCK 14 — Service Worker and Background Sync

## Prompt

```text
Implement an installable PWA using a current Workbox-compatible inject-manifest service worker.

Caching:
- app shell precache,
- network-first navigation,
- offline fallback,
- cache-first immutable assets,
- selected public resources stale-while-revalidate,
- never cache authenticated API responses or signed evidence URLs by default.

Sync:
- service-worker sync event triggers queue replay,
- browser online fallback,
- service-worker startup fallback where Background Sync is unavailable,
- message channel to app,
- sync progress,
- no duplicate queue implementation.

Add:
- install prompt,
- update-available prompt,
- standalone mode,
- offline reporter pages,
- last-known own-report summaries where safe.

Create docs/architecture/PWA_OFFLINE.md with caching matrix, privacy rules, and browser limitations.

Acceptance:
- installability passes,
- offline navigation works,
- queue replay works with and without native Background Sync.
```

## Commit

```text
feat(pwa): add service worker caching and background sync
```

---

# BLOCK 15 — Private Evidence Upload and Duplicate Checks

## Prompt

```text
Implement protected evidence upload through the web BFF.

Flow:
- authenticate,
- validate event/ownership/client_report_id,
- validate MIME and magic bytes,
- enforce size/resolution,
- decode image,
- normalize orientation,
- strip unnecessary EXIF,
- compute SHA-256,
- compute perceptual hash,
- generate thumbnail,
- store in private Supabase bucket,
- persist metadata,
- enqueue analysis job.

Signed URLs:
short-lived, role-checked, server-generated, never persisted.

Idempotency:
same client_report_id returns the existing report; duplicate hash creates a warning but is not silently discarded.

Structured error codes and tests are required.

Acceptance:
- repeated offline replay does not duplicate reports,
- invalid files fail safely,
- verifier sees quality/duplicate warnings.
```

## Commit

```text
feat(evidence): add private upload validation and duplicate checks
```

---

# BLOCK 16 — Report APIs, State Transitions, and Audit

## Prompt

```text
Implement typed BFF/domain services for:
- create report,
- own report list/detail,
- verifier queue/detail,
- coordinator operational reports,
- additional information,
- valid state transitions,
- archive where policy permits.

Use shared Zod schemas, ApiResult, stable error codes, server role checks, transactions, pagination, filters, request IDs, and audit events.

Never expose an arbitrary status-update endpoint. Every state change must use a domain command and validate actor/preconditions.

Create docs/api/REPORTS_API.md and unit/integration tests.
```

## Commit

```text
feat(api): implement report services state transitions and audit
```

---

# BLOCK 17 — GPS Capture, Accuracy, Map Pin, and Location Trust

## Prompt

```text
Implement location capture:
- high-accuracy geolocation,
- timeout/maximumAge,
- latitude, longitude, accuracy, timestamp, altitude/heading where available,
- accuracy circle,
- retry,
- manual MapLibre pin,
- address fallback,
- location source,
- event-boundary warning without blocking emergency reports.

Server:
- coordinate validation,
- PostGIS geography,
- original accuracy,
- optional reverse-geocoder adapter/cache,
- distance to event center,
- suspicious-pattern flags for human review, not automatic rejection.

Verifier UI shows source, accuracy, timestamp, boundary, and distance.

GeoJSON must use [longitude, latitude]. Never describe GPS as guaranteed truth.
```

## Commit

```text
feat(location): add gps confidence manual pin and postgis validation
```

---

# BLOCK 18 — ML Data Governance and Preparation

## Prompt

```text
Build ML data governance.

Important: ground-level citizen images differ from satellite imagery. Do not transfer satellite-only performance claims to ground photos.

Create:
ml/DATA_CARD.md, LABELING_GUIDE.md, ETHICS_AND_PRIVACY.md, configs/dataset.yaml, source/license manifest, prepare/audit/split/deduplicate scripts, tests.

Classes:
no_damage, minor_damage, major_damage, destroyed. Add invalid/uncertain as an abstention or quality path.

Pipeline:
- immutable raw data,
- corruption detection,
- duplicate/near-duplicate detection,
- face/document privacy flags,
- geographic/source-aware split,
- train/val/test,
- class audit,
- dimensions,
- label agreement,
- optional adjudication,
- reproducible hashes.

Dummy/synthetic data must be labeled. Never auto-download unclear-license datasets. Empty data must exit gracefully.
```

## Commit

```text
feat(ml-data): add governed damage-image dataset pipeline
```

---

# BLOCK 19 — Model Benchmark and Training

## Prompt

```text
Implement a fair benchmark for MobileNetV3-Large, EfficientNetV2-S, and ConvNeXt-Tiny.

Selection criteria:
macro-F1, destroyed recall, per-class metrics, expected calibration error, CPU latency, model size, robustness to poor image quality.

Create config-driven training modules for model factory, losses, metrics, early stopping, deterministic seeds, experiment logging, and checkpoints.

Training:
- transfer learning,
- benchmark 224/288 inputs,
- ImageNet normalization,
- realistic augmentation,
- class weights/focal loss comparison,
- sampler only when justified,
- mixed precision when available,
- CPU smoke mode,
- early stop on validation macro-F1,
- no fake metrics.

Optionally benchmark a two-stage quality/building-relevance gate before classification.

Produce a benchmark report and documented composite selection rule.
```

## Commit

```text
feat(ml-train): add reproducible model benchmark and training
```

---

# BLOCK 20 — Evaluation, Calibration, Abstention, Explainability, and Export

## Prompt

```text
Implement untouched-test evaluation:
confusion matrix, classification report, macro/micro/weighted F1, destroyed recall, PR curves, calibration curve, ECE, latency percentiles, model size, robustness by blur/darkness/compression/resolution, and abstention rate.

Implement probability calibration and per-class thresholds.
Low confidence/high entropy/OOD/quality failure must produce `needs_manual_review` or abstain.

Generate Grad-CAM for verifier assistance with a non-causal disclaimer.

Define release gates. If gates fail, register model as advisory-only.

Export ONNX, TorchScript, metadata JSON, preprocessing spec, checksum, and runtime benchmark.

Never evaluate on training or validation data as final evidence.
```

## Commit

```text
feat(ml-eval): add calibrated evaluation explainability and export
```

---

# BLOCK 21 — FastAPI ML API, Worker, Jobs, and Registry

## Prompt

```text
Implement apps/ml-api and apps/worker.

ML API:
GET /health
GET /ready
GET /model-info
POST /validate-image
POST /predict
POST /explain
POST /batch-predict internal only

Response includes prediction, calibrated probabilities, confidence, entropy, abstained, quality checks, model/version/checksum, preprocessing version, latency, explanation reference, disclaimer.

Security:
internal token, limits, strict origins, structured errors, correlation IDs, no external calls.

Worker:
- safely claims database jobs,
- fetches private evidence,
- validates,
- runs local inference,
- stores prediction/explanation,
- transitions report,
- retries transient failures,
- dead-letter after limit,
- heartbeat,
- audit.

Model load once. Readiness waits for model. Deterministic fallback only in DEMO_MODE and labeled.

Register model artifacts and evaluation release status.

Acceptance:
report → job → worker → prediction; worker restart does not duplicate results.
```

## Commit

```text
feat(ml-service): add inference api worker queue and registry
```

---

# BLOCK 22 — Optional Gemini Advisory

## Prompt

```text
Implement Gemini as an optional, non-authoritative verifier advisory.

Rules:
- Local CV is primary.
- Local failure/abstention keeps report in needs_manual_review.
- Gemini may create an evidence summary, suggested follow-up question, non-binding hypothesis, and quality observations.
- Raw image is sent only when enabled, explicitly requested by verifier, consent/policy permits, and external-cloud disclosure is accepted.
- Prefer redacted image or derived metadata.
- Protect against prompt injection in reporter text.
- Use structured output.
- server-only key,
- timeout/retry/rate/cost telemetry,
- complete audit,
- do not store chain-of-thought,
- never automatically change official status.

UI label:
“Analisis Tambahan Eksternal — Tidak Menentukan Keputusan Resmi”.

App must work without a Gemini key. Tests must mock provider.
```

## Commit

```text
feat(ai-advisory): add opt-in gemini verifier assistance
```

---

# BLOCK 23 — Verifier Dashboard and Human Validation

## Prompt

```text
Implement /verifier dashboard, queue, map, reports, detail, and information requests.

Dashboard metrics:
waiting, SLA warnings, low quality, duplicates, high severity, decisions today.

Queue filters:
event, predicted severity, confidence, uncertainty, quality, duplicate, GPS accuracy, age, assignment.

Detail:
private evidence, zoom, quality, duplicate links, GPS source/accuracy/boundary, probability bars, calibration/uncertainty, Grad-CAM, model metadata, optional Gemini advisory, reporter text, timeline.

Actions:
Confirm, Override with mandatory reason, Reject with reason category/note, Request Information, Insufficient Evidence, Escalate Review.

Use transactions, audit events, immutable review history, and a superseding review instead of destructive editing.

Coordinator must not see unverified private evidence by default.
```

## Commit

```text
feat(verifier): build evidence review and validation workflow
```

---

# BLOCK 24 — Coordinator Command Center and Response Tasks

## Prompt

```text
Implement /command dashboard, map, priorities, tasks, task detail, analytics, exports.

MapLibre:
verified/escalated data only, severity markers, clusters, event boundary, optional heat layer, filters, bbox queries, detail panel, accessible list fallback, tile-error fallback.

Dashboard metrics:
verified incidents, critical clusters, unassigned priority, active tasks, overdue tasks, median response time.

Clusters:
PostGIS grouping, human label, summary, severity mix, verified evidence count, related tasks.

Operational priority is separate from model severity. Critical priority requires reason and audit.

Response tasks:
create from report/cluster, category, description, assignee, due time, priority, resources, states draft/assigned/acknowledged/in_progress/blocked/completed/cancelled, timeline.

Coordinator cannot alter evidence or verifier decision.
```

## Commit

```text
feat(command): add crisis map prioritization and response tasks
```

---

# BLOCK 25 — Escalation, Realtime Notifications, and Push

## Prompt

```text
Implement configurable escalation for:
- verified destroyed above threshold,
- N destroyed within radius/time window,
- verifier SLA,
- response task overdue,
- repeated duplicate/spam source,
- repeated analysis failure.

Requirements:
settings-driven, deduplicated, idempotent, role audience, info/warning/high/critical levels, audit, read state, realtime updates.

Implement Web Push with VAPID:
subscription management, education before permission, no repeated nagging, unsubscribe, cleanup invalid subscriptions.

Demo tools:
simulate verified destroyed report and deterministic cluster escalation.

Acceptance:
one event produces one deduplicated critical notification and settings change behavior without restart.
```

## Commit

```text
feat(alerts): add configurable escalation notifications and push
```

---

# BLOCK 26 — Analytics and Audited Exports

## Prompt

```text
Implement role-specific analytics.

Verifier:
review count, agreement/override, review time, queue age, quality distribution.

Coordinator:
severity, clusters, tasks, response SLA, geography, timeline.

Admin:
service health, failures, storage, user activity, integration usage.

Auditor:
decision lineage, model usage, review revisions, external advisory, exports, retention.

Exports:
CSV, GeoJSON RFC 7946 [lng,lat], JSON, filters, async jobs for large data, signed download, field redaction, export audit event, no private evidence URLs in ordinary exports.

Charts require accessible text summaries.
```

## Commit

```text
feat(analytics): add role metrics and audited geospatial exports
```

---

# BLOCK 27 — Admin, Auditor, Model Governance, and Retention

## Prompt

```text
Implement Administrator and strictly read-only Auditor portals.

Admin:
users/roles, events, escalation settings, integration health, map status, ML API/worker status, Gemini status, storage, demo tools, retention.

Admin cannot validate, dispatch, or change audit events.

Auditor:
audit filters/detail, decision lineage, model registry, model comparison, active model, evaluation gates, Gemini usage log, export history, retention/deletion evidence.

Retention:
offline cleanup, evidence retention, deletion request workflow placeholder, legal hold placeholder, audit retention separated from evidence.

Acceptance:
Auditor exposes no mutation route; every admin setting change is audited; prediction model version is traceable.
```

## Commit

```text
feat(governance): add administration audit and model oversight
```

---

# BLOCK 28 — Security, Privacy, Rate Limits, and Observability

## Prompt

```text
Harden:
CSP, secure headers, CSRF/origin checks, same-site cookies, request/file limits, signed URL expiry, rate limiting, MIME/magic-byte validation, RLS, least privilege, secret scanning, dependency audit, sanitized logs, Gemini prompt-injection protection, telemetry PII redaction.

Privacy:
consent versioning, purpose limitation, retention notice, offline storage notice, external Gemini disclosure, account/data request placeholder.

Observability:
structured logs, correlation IDs, optional Sentry, worker metrics, queue depth, job duration, model latency, upload/sync failure, escalation counts, health dashboard.

Create SECURITY_CHECKLIST.md, PRIVACY_MODEL.md, OBSERVABILITY.md. Test role boundaries. Logs must not contain secrets or raw image bytes.
```

## Commit

```text
chore(security): harden mboyo privacy and observability
```

---

# BLOCK 29 — Complete Test Suite

## Prompt

```text
Implement:

Web unit:
domain transitions, Zod, permissions, queue, GPS utilities, GeoJSON.

Integration:
Supabase local, RLS denial, report creation, signed URLs, job, verification, task, escalation, export.

Playwright E2E:
Reporter login → report → offline submit → reload persists → reconnect → sync → worker prediction → verifier confirms → coordinator map → task → auditor lineage.

PWA:
service worker, offline fallback, update, background replay.

ML:
data pipeline, smoke training, inference schema, calibration, deterministic artifacts, no fabricated metrics.

Load:
report list, bbox query, export, jobs, 10k reports, optional 100k synthetic.

Accessibility:
axe and keyboard flows.

CI must run deterministically.
```

## Commit

```text
test(platform): add end-to-end offline ml and rbac coverage
```

---

# BLOCK 30 — Deterministic Demo Mode

## Prompt

```text
Create safe deterministic demo mode.

Seed:
one event, realistic Indonesian coordinates, 50 primary reports, optional 10k scale reports, all severities/states, duplicates, low quality, GPS denied/manual pin, verified incidents, clusters, tasks, notifications, audit, model versions marked demo.

Accounts:
reporter@mboyo.demo
verifier@mboyo.demo
coordinator@mboyo.demo
admin@mboyo.demo
auditor@mboyo.demo
Password DemoMboyo2026!

Admin-only demo tools:
reset seed, simulate offline reporter, model abstention, destroyed cluster, overdue task, ML outage, Gemini enabled/disabled.

Disabled in production. Visual Demo Mode badge. Never label dummy metrics as real.
```

## Commit

```text
feat(demo): add deterministic scenarios accounts and tools
```

---

# BLOCK 31 — Docker, CI/CD, Deployment, Backup, and Rollback

## Prompt

```text
Productionize:
- non-root multi-stage web image,
- ml-api image,
- worker image,
- health checks,
- resource guidance,
- model artifact strategy.

CI:
install, lint, typecheck, unit, Python, build, E2E, migration validation, secret scan, dependency audit, artifacts.

Targets:
web on Vercel/container; ML API/worker on Cloud Run/Railway/Render/Fly/VPS; data on Supabase; production map provider; optional Sentry.

Create:
LOCAL_DEVELOPMENT.md, ENVIRONMENT.md, DEPLOYMENT.md, ROLLBACK.md, INCIDENT_RESPONSE.md, BACKUP_RESTORE.md.

Include staging/production matrix, migration ordering, rollback, model rollback, backups, smoke tests, and no dirty-tree release.

Fresh clone must run demo mode. Staging must pass smoke checks.
```

## Commit

```text
ci(deploy): add containers pipelines and production runbooks
```

---

# BLOCK 32 — Performance, Accessibility, and PWA Audit

## Prompt

```text
Audit 360, 390, 480, 768, 834, 1024, 1280, 1440 widths across public, login, reporter, queue, verifier, detail, command map, tasks, analytics, admin, audit.

Performance:
image compression, splitting, dynamic map, virtual lists, bbox loading, clustering, pagination, bundle analysis, Core Web Vitals, cache budget. Never render 10k DOM markers.

Accessibility:
headings, labels, focus, dialogs, drawers, map list alternative, chart summaries, contrast, reduced motion, touch targets, aria-live sync and notifications.

PWA:
install, offline, update, queue reliability, icons.

Create docs/QUALITY_AUDIT.md with issue/fix evidence.

Target Lighthouse accessibility >=90 and keyboard-complete core demo.
```

## Commit

```text
perf(app): optimize mboyo accessibility responsiveness and pwa quality
```

---

# BLOCK 33 — Live Demo, Presentation, and Technical Defense

## Prompt

```text
Create LIVE_DEMO_SCRIPT.md, PRESENTATION_FLOW.md, JUDGE_QA.md, TECHNICAL_DEFENSE.md, PRE_DEMO_CHECKLIST.md, PLAN_B.md.

Demo:
landing → Reporter report/photo/GPS → offline → submit → reload persistence → online autosync → analysis job/local model → Verifier probability/quality/GPS/explanation → confirm/override → Coordinator verified map → create task → simulate destroyed cluster → critical alert → analytics/GeoJSON → Auditor lineage → Admin sovereignty/service health.

Explain honestly:
accuracy measured not guaranteed; human verification mandatory; GPS has accuracy and spoofing limits; Gemini optional external advisory; local CV primary; IndexedDB+SW offline; private storage/RLS production.

Plan B:
no internet, map down, ML down, Gemini unavailable, Supabase issue, Background Sync unsupported, camera/GPS denied.

Only claim implemented behavior.
```

## Commit

```text
docs(demo): add live presentation and technical defense
```

---

# BLOCK 34 — Release Hardening

## Prompt

```text
Perform final audit without major new features:
routes, links, auth, RBAC, RLS, transitions, queue, SW, idempotency, evidence privacy, worker retry, ML readiness, Gemini-off behavior, map fallback, notifications, exports, audit immutability, settings, demo reset, accessibility, responsive design, tests, build, Docker, staging, docs, secrets, dependencies.

Create RELEASE_CHECKLIST.md, KNOWN_LIMITATIONS.md, CHANGELOG.md, RELEASE_NOTES.md.

Run all checks. Fix verified issues only. Report unresolved issues with severity/workaround.

Recommended tag: v1.0.0-capstone.
```

## Commit

```text
chore(release): harden mboyo capstone release
```

---

# Production/Demo Definition of Done

- A real photo Blob can be submitted offline.
- IndexedDB queue survives reload and browser restart.
- Connectivity recovery syncs automatically and idempotently.
- Evidence is private with short-lived signed access.
- A versioned local model or explicitly marked demo fallback analyzes evidence.
- Low-confidence/OOD output abstains.
- Verifier decisions are reasoned and immutable.
- Coordinator sees verified operational data only.
- Coordinator can create and complete a response task.
- Escalation is configurable and deduplicated.
- Auditor can trace reporter → evidence → model → verifier → coordinator → export.
- Admin cannot silently perform operational decisions.
- Gemini is optional, disclosed, auditable, and non-authoritative.
- GeoJSON is valid.
- Mobile, tablet, and desktop are responsive.
- PWA install/offline/update work.
- Core E2E and RBAC tests pass.
- Demo reset and Plan B are reliable.
