# AGENTS.md — MBOYO Engineering Contract

## Identity and Mission

MBOYO is an offline-first disaster reporting, computer vision, geospatial command, human verification, and response coordination platform.

Tagline: **"Laporan Tetap Jalan. Respons Lebih Tepat."**

Built for VETERAN KUKUS × Hackathon Bank Indonesia 2026 capstone, targeting Top 80 readiness, with a production-minded architecture and a deterministic live-demo mode.

## Repository State (as of BLOCK 00)

This repository is currently empty — no application code, manifests, lockfiles, or prior documentation exist. There is nothing to reuse and no technical debt yet. All architecture below is the target structure to scaffold in later blocks, not a description of current state.

## Architecture Boundaries

```text
mboyo/
├─ apps/
│  ├─ web/        # Next.js App Router PWA and BFF — UI, auth session, API routes
│  ├─ ml-api/      # FastAPI model inference API — stateless, internal-token gated
│  └─ worker/      # Python job worker — consumes analysis_jobs, writes results back
├─ packages/
│  ├─ ui/                    # Shared React components
│  ├─ domain/                 # Shared types, schemas, domain logic
│  ├─ api-client/              # Typed client for ml-api / web BFF
│  ├─ config-eslint/
│  └─ config-typescript/
├─ supabase/       # Migrations, RLS policies, edge functions, seed data — source of truth for schema and access control
├─ ml/             # Training data, configs, model source, evaluation reports — never touched by apps/web directly
├─ infra/          # Deployment and infra-as-code
├─ scripts/        # One-off and CI scripts
└─ docs/           # Product and engineering documentation
```

Boundary rules:
- `apps/web` never talks to the database with elevated privileges from client-side code; service-role usage is server-only.
- `apps/web` never imports directly from `ml/`; it calls `apps/ml-api` over HTTP with `ML_INTERNAL_TOKEN`.
- `apps/worker` is the only writer of `analysis_jobs` results; `apps/web` only enqueues and reads.
- `supabase/policies` (RLS) is the enforcement layer for RBAC — server code must not assume it can bypass RLS except through explicitly service-role-gated internal routes.
- `packages/*` contain no environment-specific secrets or runtime side effects at import time.

## RBAC — Non-Overlapping Role Boundaries

Five roles, no implicit privilege overlap. Every new feature must state which role(s) it belongs to and confirm it does not grant a forbidden capability.

### Reporter
- Allowed: create/save reports, capture/select photo and GPS, submit offline, view own queue and own reports, respond to information requests.
- Forbidden: viewing others' private reports, AI validation, setting response priority, dispatching tasks, system configuration.

### Verifier
- Allowed: inspect evidence, quality, duplicates, location confidence, model probabilities, and explanations; confirm, override, reject, request info, or escalate for senior review.
- Forbidden: dispatching resources, changing operational priority, managing roles/settings, deleting audit history.

### Response Coordinator
- Allowed: view verified/escalated incidents, set operational priority, group incidents, create/assign/track response tasks, export operational data.
- Forbidden: changing original evidence, changing verifier decisions or model probabilities, managing users/settings.

### System Administrator
- Allowed: manage users, role assignments, events, integrations, thresholds, retention, and service health.
- Forbidden by default: validating reports, dispatching response tasks, editing or deleting audit events.

### Auditor
- Allowed: read-only access to audit lineage, reports, model registry, evaluations, external advisory usage, exports, and retention evidence.
- Forbidden: any mutation, anywhere, ever.

When implementing any endpoint, UI action, or RLS policy, verify it maps to exactly one of the allowed lists above and does not silently grant a forbidden capability to another role.

## Next.js Local-Documentation Rule

Before using any Next.js App Router API, data fetching, caching, middleware, or route handler behavior, consult the locally installed docs under `node_modules/next/dist/docs/` for the exact installed version. Installed API behavior may differ from prior training knowledge or from the public docs for other versions. Do not assume behavior from memory when the local docs are available and contradict it.

## TypeScript and Python Standards

- TypeScript: `strict` mode required repo-wide. No `any` used to silence errors — if a type is genuinely unknown, model it (`unknown` + narrowing, discriminated unions, zod schemas at boundaries).
- No disabled lint rules (`eslint-disable`) as a substitute for fixing the underlying issue. If a rule must be disabled, it requires a one-line comment explaining why and is scoped to the single line/block, not the file.
- Python: type hints required on all function signatures in `ml/`, `apps/ml-api`, and `apps/worker`. Use `mypy`-compatible typing; avoid `Any` for the same reasons as TypeScript `any`.
- Validation happens at system boundaries (API route input, form input, external API responses) using Zod (TS) or pydantic (Python) — not scattered ad hoc checks deep in business logic.

## Offline-First Invariants

- Reporters must be able to create, save, and queue reports fully offline; report creation must never depend on a live network call.
- Local queue (Dexie/IndexedDB) is the source of truth until sync succeeds; sync is additive/idempotent, never destructive to local unsynced data.
- Background Sync (service worker) retries without user action; failures are visible to the user, never silently dropped.
- Conflict resolution and sync status must be observable in the UI — no silent data loss on reconnect.

## ML Honesty and Evaluation Rules

- Never describe model accuracy, precision, recall, or any metric as guaranteed. All reported metrics must be measured on an untouched, held-out test set and labeled with the evaluation set and date.
- No fabricated metrics, no placeholder numbers presented as real results, no cherry-picked examples presented as representative performance.
- Model outputs are probabilistic signals for human verifiers, not final determinations — the Verifier role's authority over classification decisions must never be bypassed by automation.
- Any demo fallback (mocked inference, canned responses, simulated confidence scores) must be visibly labeled in the UI and clearly marked in code (e.g., a `DEMO_MODE` flag and visible badge), never presented as a genuine model result.

## Secrets and Security Rules

- Never commit `.env`, credentials, private keys, service-role keys, raw sensitive evidence, or generated secrets.
- `SUPABASE_SERVICE_ROLE_KEY`, `ML_INTERNAL_TOKEN`, `VAPID_PRIVATE_KEY`, `SESSION_SIGNING_SECRET`, `CRON_SECRET`, and `GEMINI_API_KEY` must never be exposed to browser/client code or `NEXT_PUBLIC_*` variables.
- Before staging or committing, review `git status`/`git diff` output for anything that looks like a secret, even in files with innocuous names.
- Raw uploaded evidence (photos, GPS-tagged media) is sensitive; access is gated by RLS and role, never served through public/unauthenticated URLs by default.

## Semantic Commit Format

```text
<type>(<scope>): <short imperative summary>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`.
Scope: the app/package/domain touched (e.g., `web`, `ml-api`, `worker`, `supabase`, `project`).

Example: `docs(project): define mboyo engineering contract and agent rules`

## Demo Fallback Disclosure Requirement

Any time a feature uses a simulated, mocked, canned, or otherwise non-live behavior for demo purposes, it must be:
1. Gated behind an explicit flag (e.g. `DEMO_MODE=true`, `NEXT_PUBLIC_DEMO_MODE=true`).
2. Visibly labeled in the UI (e.g., a badge or banner, in Bahasa Indonesia, stating the data/result is simulated).
3. Documented in the block's final summary under "limitations."

## User-Facing Copy

All user-facing copy (UI text, notifications, error messages, emails) must be written in Bahasa Indonesia.

## Final Agent Response Format

Every block/task must end with:
1. **Summary** — what changed and why.
2. **Changed files** — explicit list.
3. **Verification results** — commands run and their outcomes (lint, typecheck, tests, build).
4. **Limitations** — including any demo fallbacks, known gaps, or deferred work.
5. **Next block** — what should happen next.
