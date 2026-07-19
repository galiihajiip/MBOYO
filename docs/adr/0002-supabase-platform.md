# ADR 0002 — Supabase as the Platform (Auth, Postgres/PostGIS, Storage, Realtime)

## Status

Accepted

## Context

MBOYO needs authentication with role attribution, a relational store capable of geospatial queries (GPS coordinates, geofence checks per [THREAT_MODEL.md](../security/THREAT_MODEL.md) threat #3), file storage for evidence photos with fine-grained access control, and a mechanism for live updates to Verifier/Coordinator UIs — all within a capstone timeline that does not afford building and operating separate bespoke services for each concern.

## Decision

Adopt Supabase as the unified platform: Supabase Auth for identity/session, Postgres with the PostGIS extension for the relational + geospatial store, Supabase Storage for evidence files (in a private, non-public bucket), and Supabase Realtime for live query subscriptions.

## Consequences

- Row-Level Security (RLS) becomes the primary enforcement mechanism for the five-role RBAC model in [AGENTS.md](../../AGENTS.md) — policies in `supabase/policies` are not an optional hardening layer, they are load-bearing, per [THREAT_MODEL.md](../security/THREAT_MODEL.md) threat #4 (broken access control).
- PostGIS gives native support for storing GPS coordinates as proper geospatial types and running distance/containment queries (e.g., geofence cross-checks), avoiding a bespoke geospatial library integration.
- A single managed platform reduces operational surface area (one vendor for auth/db/storage/realtime) at the cost of a single-vendor dependency, explicitly accepted as a capstone-scope limitation in [RISK_REGISTER.md](../product/RISK_REGISTER.md) risk #8 and [PRODUCTION_SCOPE.md](../product/PRODUCTION_SCOPE.md) (no multi-region failover).
- `SUPABASE_SERVICE_ROLE_KEY` becomes the single highest-value credential in the system (it bypasses RLS), requiring the strict custody rules in [AGENTS.md](../../AGENTS.md) and [THREAT_MODEL.md](../security/THREAT_MODEL.md) threat #6.
- Realtime is used for UX responsiveness (live Verifier queue, live Coordinator map) but Postgres remains the system of record — Realtime failures degrade freshness, not correctness, since clients can always fall back to polling/refetch.

## Alternatives Considered

- **Bespoke stack (separate Auth0/Cognito + self-managed Postgres + S3 + custom websocket server):** rejected for this project stage — significantly more integration and operational work for capabilities Supabase provides as a cohesive unit, without a concrete requirement that demands the extra flexibility.
- **Firebase:** rejected — weaker fit for relational/geospatial querying needs (PostGIS specifically) and RLS-style fine-grained SQL-based authorization, which is central to the RBAC enforcement strategy here.
