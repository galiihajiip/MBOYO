# ADR 0003 — Database-Backed `analysis_jobs` Queue (No External Broker)

## Status

Accepted

## Context

Report ingestion (fast, must never block on ML inference) needs to be decoupled from CV inference (slower, can fail/retry independently), per the offline-first invariant in [AGENTS.md](../../AGENTS.md) that report submission never depends on `apps/ml-api` availability. A queue is needed between "report synced" and "`apps/worker` runs inference and writes results back." The options are an external message broker (Redis, SQS, RabbitMQ, etc.) or a plain database table used as a queue.

## Decision

Use a Postgres table, `analysis_jobs`, as the job queue, with `apps/worker` claiming jobs via an atomic `UPDATE ... WHERE status = 'queued' ... RETURNING` (or equivalent `FOR UPDATE SKIP LOCKED` pattern), rather than introducing a separate broker service.

## Consequences

- No additional infrastructure component to deploy, secure, or operate (per [DEPLOYMENT_TOPOLOGY.md](../architecture/DEPLOYMENT_TOPOLOGY.md), fewer network paths and secrets to manage) — directly supports the capstone-timeline constraint.
- Job state (`queued`/`processing`/`done`/`failed`), claim ownership, attempt counts, and results all live in the same transactional store as the rest of the domain data, making the Auditor's lineage view (report → job → verification → task) a straightforward join rather than needing to correlate across two different systems (Postgres + a broker).
- The atomic claim query is what makes concurrent `apps/worker` instances safe without a distributed lock service — this is the specific mechanism that satisfies the "worker safe job claiming" requirement, and is documented precisely in [SEQUENCE_FLOWS.md](../architecture/SEQUENCE_FLOWS.md) Diagram 4.
- A claimed-but-never-completed job (crashed worker) is recoverable by re-claim after a lease-expiry check on `claimed_at`, without needing broker-specific dead-letter/visibility-timeout features.
- Throughput ceiling is lower than a purpose-built broker at very high volume (frequent polling, row-level lock contention at scale) — acceptable for MVP/Enhanced Demo scale per [MVP_SCOPE.md](../product/MVP_SCOPE.md), flagged as a scaling consideration if volume grows well beyond a single hackathon-event scale (Tier 4 territory).
- `System Administrator` gets job-status visibility for free via a normal SQL query against `analysis_jobs`, satisfying the service-health observability requirement in [PRODUCTION_SCOPE.md](../product/PRODUCTION_SCOPE.md) without extra tooling.

## Alternatives Considered

- **Redis-backed queue (e.g., BullMQ):** rejected for this stage — adds a second stateful service to deploy/secure/monitor, and Redis pub/sub-based job state doesn't naturally participate in the same audit-trail joins as the rest of the domain model.
- **Managed broker (SQS/Cloud Tasks):** rejected — ties the architecture to a specific cloud provider's queueing product, adds another credential/IAM surface, and provides throughput headroom far beyond what this project's scale requires.
