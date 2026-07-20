# MBOYO Local Supabase Platform

This document describes the local development configuration of the Supabase platform (`supabase/config.toml`), the TypeScript and Python environment validation layers, and the two Supabase client types in `apps/web`. It complements [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) and [ADR 0002](../adr/0002-supabase-platform.md) — this document is the concrete "how to run it locally" companion to those architectural decisions.

BLOCK 07 established the platform itself (Auth, Postgres+PostGIS, Storage, Realtime) and the environment-validation/client-access layers around it, without domain schema. BLOCK 08 (see [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)) implements the full domain schema, RLS policies, RPC functions, seed data, and pgTAP tests on top of this platform — this document is updated in place to reflect both blocks together rather than describing a now-superseded "schema not yet implemented" state.

## Prerequisites

- Docker Desktop (or a Docker-compatible daemon) running — Supabase's local stack runs as a set of Docker containers.
- The `supabase` CLI, installed as a workspace devDependency (`pnpm install` pulls it in) — no global install required. Verify with `pnpm exec supabase --version`.

## Services Configured

`supabase/config.toml` enables exactly the services this project depends on, matching [ADR 0002](../adr/0002-supabase-platform.md) and [AGENTS.md](../../AGENTS.md):

| Service | Local port | Purpose |
|---|---|---|
| API (PostgREST + Auth + Storage gateway) | 54321 | The endpoint `NEXT_PUBLIC_SUPABASE_URL` points at locally. |
| Postgres | 54322 | Relational + geospatial (PostGIS) store. |
| Studio | 54323 | Local admin UI for inspecting data/schema during development. |
| Inbucket | 54324 | Local email capture for Auth flows (password reset, etc.) — no real email is sent locally. |

Realtime is enabled (`[realtime] enabled = true`) for the live-update use cases described in [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) (Verifier queue, Coordinator map) — Postgres remains the system of record; Realtime failures degrade freshness, not correctness, per [ADR 0002](../adr/0002-supabase-platform.md).

## PostGIS

PostGIS is enabled via the first migration, [`supabase/migrations/20260716145222_enable_postgis.sql`](../../supabase/migrations/20260716145222_enable_postgis.sql):

```sql
create extension if not exists postgis with schema extensions;
```

This is a platform-level concern (geospatial types/queries needed for `geolocation_observation` and `disaster_event.geofence` per [DOMAIN_MODEL.md](../product/DOMAIN_MODEL.md) and the GPS/geofence threat model in [THREAT_MODEL.md](../security/THREAT_MODEL.md) threat #3), not domain schema — no application tables are created by this migration. `config.toml`'s `extra_search_path = ["public", "extensions"]` ensures PostGIS functions/types are resolvable without schema-qualifying every query.

To confirm PostGIS is present in a running local database:

```bash
pnpm db:start
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "SELECT PostGIS_Version();"
```

A successful result (a version string, not an error) is the acceptance criterion for "PostGIS exists."

## Storage Buckets

Two private buckets are configured in `supabase/config.toml`, per [AGENTS.md](../../AGENTS.md) secrets/security rules and [THREAT_MODEL.md](../security/THREAT_MODEL.md) threat #9 (sensitive imagery):

- **`report-evidence`** (`SUPABASE_REPORTS_BUCKET`) — report photos. `public = false`; restricted to image MIME types; 25MiB limit. Never served through public/unauthenticated URLs — access is via signed URLs issued server-side only, once report/evidence RLS policies exist in a later block.
- **`generated-exports`** (`SUPABASE_EXPORTS_BUCKET`) — Coordinator/Auditor-generated CSV/GeoJSON exports per `export_job` in [DOMAIN_MODEL.md](../product/DOMAIN_MODEL.md). `public = false`; restricted to CSV/GeoJSON/JSON MIME types.

Neither bucket has RLS-backed access policies yet — bucket *existence* and *non-public* configuration is this block's scope; per-role Storage access policies are implemented alongside the domain schema/RLS in a later block, matching [RBAC_MATRIX.md](../product/RBAC_MATRIX.md).

## Auth

Local Auth is enabled with email sign-up (`enable_signup = true`) and email confirmations disabled (`enable_confirmations = false`) purely for local development convenience — this must not be carried into a staging/production configuration, where confirmation should be re-enabled. `site_url`/`additional_redirect_urls` point at `http://localhost:3000` (`apps/web`'s dev server).

## Root Commands

| Command | Effect |
|---|---|
| `pnpm db:start` | Starts the local Supabase stack (`supabase start`). Requires Docker running. |
| `pnpm db:stop` | Stops the local stack (`supabase stop`). |
| `pnpm db:reset` | Drops and recreates the local database from migrations + `supabase/seed.sql` (`supabase db reset`). |
| `pnpm db:types` | Generates TypeScript types from the local schema into `packages/domain/src/supabase-types.generated.ts` (`supabase gen types typescript --local`). Produces an (currently near-empty) types file until domain schema exists. |

## Environment Validation

### TypeScript (`packages/domain/src/env.ts`)

`loadServerEnv()`/`loadClientEnv()` (built in BLOCK 05, unchanged in shape by this block) validate `process.env` against Zod schemas and throw a field-by-field, human-readable error listing every missing/invalid variable — never a raw Zod exception, never a silent fallback to an empty string for a required credential. `apps/web`'s `getServerEnv()`/`getClientEnv()` wrappers ([env.server.ts](../../apps/web/src/lib/env.server.ts), [env.client.ts](../../apps/web/src/lib/env.client.ts)) call these lazily — importing the modules never fails a build with no `.env` present; only actually calling the getter at request time does, so `next build` in CI (no real secrets) still succeeds.

### Python (`apps/ml-api/app/config.py`, `apps/worker/worker/config.py`)

Both use `pydantic-settings`. As of this block, required secrets (`apps/worker`'s `database_url`, `supabase_service_role_key`, `ml_internal_token`; `apps/ml-api`'s `ml_internal_token`) have **no default value** — omitting them from the environment causes `Settings()` construction to raise `pydantic.ValidationError` with one line per missing field:

```text
3 validation errors for Settings
database_url
  Field required [type=missing, input_value={}, input_type=dict]
supabase_service_role_key
  Field required [type=missing, input_value={}, input_type=dict]
ml_internal_token
  Field required [type=missing, input_value={}, input_type=dict]
```

This mirrors the TypeScript side's fail-loudly behavior exactly. Like the TypeScript wrappers, `get_settings()` is not memoized at module import time — importing `worker.config` or `app.config` never requires real secrets; only calling `get_settings()` at the point of actual use does, so unit tests and static analysis of these modules don't need a populated `.env`.

## Supabase Clients in `apps/web`

Three client modules exist under `apps/web/src/lib/supabase/`, each with a distinct trust boundary:

### `service-role.server.ts` — bypasses RLS entirely

```ts
import "server-only";
```

Holds `SUPABASE_SERVICE_ROLE_KEY` — the single highest-value credential in the system ([THREAT_MODEL.md](../security/THREAT_MODEL.md) threat #6). The `server-only` import makes any accidental import from a Client Component fail the Next.js build at compile time, not just by convention. Reserved for the small set of server-only routes with an explicit, documented reason to bypass RLS; ordinary data access should not use this client.

### `server.ts` — RLS-scoped, server-side, session-aware

Uses `@supabase/ssr`'s `createServerClient`, wired to the current request's auth cookies via `next/headers`. Used from Server Components and Route Handlers acting on behalf of the signed-in user — RLS applies exactly as it would for the browser client, since this client uses the anon key plus the user's own session, never the service-role key.

### `browser.ts` — RLS-scoped, client-side

Uses `@supabase/ssr`'s `createBrowserClient`, reading only `getClientEnv()` (the `NEXT_PUBLIC_*`-only validated subset). This is the one client reachable from Client Components; its entire import graph must stay free of `getServerEnv`, `SUPABASE_SERVICE_ROLE_KEY`, or the service-role client module.

### Verifying secrets never reach the client bundle

After `pnpm build`, the built client-side chunks can be checked directly:

```bash
grep -rl "SUPABASE_SERVICE_ROLE_KEY" apps/web/.next/static/chunks/
```

No matches is the acceptance criterion for "server secrets never enter client bundle" — verified during this block's own verification pass, not just asserted by code structure.

## Known Local Environment Caveat

`supabase/config.toml`'s schema has been verified against the installed CLI version (`pnpm exec supabase --version` → 2.109.1) — the config-parsing stage completes successfully (confirmed by the CLI proceeding to image pulls rather than failing on config validation). On this particular development machine, `pnpm db:start` failed during Docker image pulls with `input/output error` writes to Docker Desktop's containerd storage. Root-caused (not just Docker-level): the host `C:` drive had **0 bytes free out of 238GB** at the time of this block — confirmed by a separate, unrelated `ENOSPC` failure from `npx tsx` during another verification step. This is a host disk-space exhaustion issue, not a defect in this project's Supabase configuration or Docker setup. Once disk space is freed, `pnpm db:start` should proceed to actually pull images and start containers against the config in this document.

## Schema, RLS, RPC Functions, and Seed Data (BLOCK 08)

Domain schema (all 22 entities per [DOMAIN_MODEL.md](../product/DOMAIN_MODEL.md)), RLS policies matching [RBAC_MATRIX.md](../product/RBAC_MATRIX.md) exactly, geospatial/queue-claim RPC functions, Realtime publication, seed data, and pgTAP tests are implemented in the migrations under `supabase/migrations/` and `supabase/seed.sql` — see [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) for the full description.

## What Remains Outstanding

- Storage bucket **access policies** (fine-grained who-can-read-which-object rules on the `report-evidence`/`generated-exports` buckets) are not yet implemented — bucket existence/non-public configuration (BLOCK 07) and table-level RLS (BLOCK 08) are both in place, but Storage object-level policies are a distinct mechanism, deferred to the block that implements evidence upload/signed-URL issuance.
- `packages/domain/src/supabase-types.generated.ts` has not yet been regenerated against the BLOCK 08 schema in this environment — pending live `pnpm db:start`/`db:types` verification (see the caveat below).
