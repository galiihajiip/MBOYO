# MBOYO Domain Model

This document defines the 22 core entities backing the [MVP live flow](PRODUCT_CHARTER.md#the-mvp-live-flow) and the architecture in [SYSTEM_ARCHITECTURE.md](../architecture/SYSTEM_ARCHITECTURE.md). It is the reference for `supabase/migrations` schema design in a later block — this document defines shape and relationships, not SQL DDL.

Field lists here are the fields needed to reason about state, ownership, and RBAC; they are not exhaustive column lists.

## Entity Reference

### `organization`
The top-level tenant boundary (single org at MVP per [MVP_SCOPE.md](MVP_SCOPE.md), architecture allows more later).
- Fields: `id`, `name`, `created_at`.
- Owned by: System Administrator (configuration).

### `profile`
A person's identity record, one per authenticated user, separate from `auth.users` (Supabase-managed) so the domain can carry additional fields without touching the auth schema.
- Fields: `id`, `user_id` (→ Supabase Auth), `organization_id`, `display_name`, `phone`, `created_at`.
- Owned by: the user themself (own profile fields), System Administrator (organization-wide profile management).

### `role_assignment`
Links a `profile` to one or more of the five roles (Reporter, Verifier, Response Coordinator, System Administrator, Auditor) — modeled as a separate join entity, not a single `role` column, since [AGENTS.md](../../AGENTS.md) does not preclude a person holding role context across events, and because RLS policies key off this table rather than a client-supplied claim.
- Fields: `id`, `profile_id`, `role` (enum), `organization_id`, `granted_by`, `granted_at`, `revoked_at`.
- Owned by: System Administrator exclusively.

### `disaster_event`
The operational context (e.g., a specific flood/earthquake event) that reports, incidents, and tasks belong to. MVP scopes to one seeded event ([MVP_SCOPE.md](MVP_SCOPE.md)); Enhanced Demo adds multiple concurrent events.
- Fields: `id`, `organization_id`, `name`, `status` (`active`/`closed`), `geofence` (PostGIS polygon, used by the GPS-confidence cross-check in [THREAT_MODEL.md](../security/THREAT_MODEL.md) threat #3), `starts_at`, `ends_at`.
- Owned by: System Administrator.

### `report`
The central entity — a Reporter's submission. Carries the [state machine](STATE_MACHINES.md#report-state-machine) that is the backbone of the entire flow.
- Fields: `id`, `dedupe_key` (client-generated, unique — see [ADR 0005](../adr/0005-offline-indexeddb-workbox.md)), `reporter_profile_id`, `disaster_event_id`, `status`, `description`, `created_at_client` (device-local timestamp), `submitted_at`, `updated_at`.
- Owned by: the reporting Reporter (create, read own); Verifier (read all, transition via verification); System Administrator never mutates report content directly.

### `report_evidence`
One or more evidence files (photos) attached to a report, stored in the private Storage bucket (per [ADR 0002](../adr/0002-supabase-platform.md)).
- Fields: `id`, `report_id`, `storage_path`, `mime_type`, `size_bytes`, `uploaded_at`.
- Owned by: Reporter (create, at submission time only — immutable afterward, per [AGENTS.md](../../AGENTS.md) "Verifier/Coordinator never change original evidence").

### `geolocation_observation`
The GPS capture(s) associated with a report — modeled as its own entity (not just lat/lng columns on `report`) so multiple observations (e.g., a retry with a better fix) and their individual confidence can be tracked, feeding [THREAT_MODEL.md](../security/THREAT_MODEL.md) threat #3.
- Fields: `id`, `report_id`, `latitude`, `longitude`, `accuracy_meters`, `captured_at_client`, `confidence_signal` (computed).
- Owned by: created by Reporter's client at capture time; confidence signal computed server-side/by `apps/worker`.

### `analysis_job`
The job-queue row from [ADR 0003](../adr/0003-database-job-queue.md) — the mechanism that decouples ingestion from CV inference.
- Fields: `id`, `report_id`, `status` (`queued`/`processing`/`done`/`failed`), `claimed_by`, `claimed_at`, `attempts`, `model_registry_entry_id`, `created_at`, `completed_at`.
- Owned by: `apps/worker` exclusively (claim and write-back); no human role mutates this directly.

### `model_prediction`
The CV model's output for a completed `analysis_job` — probabilities per severity class, quality signal, duplicate signal.
- Fields: `id`, `analysis_job_id`, `report_id`, `severity_probabilities` (JSON: per class in `unknown`/`no_damage`/`minor_damage`/`major_damage`/`destroyed`), `quality_score`, `duplicate_candidate_report_id` (nullable), `is_advisory_only` (per the release-gate fallback in [SUCCESS_METRICS.md](SUCCESS_METRICS.md)), `created_at`.
- Owned by: `apps/worker` (write, once); Verifier (read).

### `model_explanation`
Human-readable/visual explanation accompanying a `model_prediction` (e.g., saliency region, top contributing factors) — kept separate from `model_prediction` so explanation methods can evolve independently of the core probability schema.
- Fields: `id`, `model_prediction_id`, `explanation_type`, `payload` (JSON or storage reference), `created_at`.
- Owned by: `apps/worker` (write, once); Verifier (read).

### `verification_review`
The Verifier's decision — the single most important human-accountability record in the system, per [AGENTS.md](../../AGENTS.md) "Verifier owns evidence and classification decisions."
- Fields: `id`, `report_id`, `verifier_profile_id`, `decision` (`confirm`/`override`/`reject`/`request_info`/`escalate`), `override_severity` (nullable, only set on `override`), `notes`, `decided_at`.
- Owned by: Verifier exclusively (create); immutable once created — a correction is a new row, not an edit, preserving the audit trail.

### `incident_cluster`
A Coordinator-created grouping of related incidents (e.g., same building/road segment), per [MVP_SCOPE.md](MVP_SCOPE.md) Tier 2.
- Fields: `id`, `disaster_event_id`, `label`, `priority`, `created_by_profile_id`, `created_at`.
- Owned by: Response Coordinator exclusively.

### `cluster_member`
Join entity linking a verified `report` (incident) to an `incident_cluster`.
- Fields: `id`, `incident_cluster_id`, `report_id`, `added_at`.
- Owned by: Response Coordinator.

### `response_task`
An operational task dispatched against a verified incident (or cluster).
- Fields: `id`, `report_id` (or `incident_cluster_id`), `status` (per [task state machine](STATE_MACHINES.md#task-state-machine)), `priority`, `created_by_profile_id`, `created_at`, `closed_at`.
- Owned by: Response Coordinator exclusively (create, update status/priority).

### `task_assignment`
Links a `response_task` to the responder(s) assigned to execute it — separate from `response_task` so reassignment history is preserved.
- Fields: `id`, `response_task_id`, `assignee_profile_id`, `assigned_by_profile_id`, `assigned_at`, `unassigned_at`.
- Owned by: Response Coordinator exclusively.

### `notification`
An in-app/push notification instance (e.g., new item in Verifier queue, new incident for Coordinator).
- Fields: `id`, `recipient_profile_id`, `type`, `payload`, `read_at`, `created_at`.
- Owned by: system-generated (triggered by state transitions), read/dismiss by the recipient.

### `push_subscription`
A registered Web Push endpoint for a profile (Enhanced Demo tier, VAPID per [MVP_SCOPE.md](MVP_SCOPE.md)).
- Fields: `id`, `profile_id`, `endpoint`, `keys` (encrypted), `created_at`.
- Owned by: the subscribing user (create/delete own).

### `export_job`
A Response Coordinator-initiated data export (CSV/GeoJSON, Enhanced Demo tier).
- Fields: `id`, `requested_by_profile_id`, `disaster_event_id`, `format`, `filter_criteria`, `status`, `storage_path` (result), `created_at`, `completed_at`.
- Owned by: Response Coordinator (create); System Administrator/Auditor (read for oversight).

### `audit_event`
The append-only lineage record — see [THREAT_MODEL.md](../security/THREAT_MODEL.md) threat #12 (audit tampering) for why this is insert-only with no `UPDATE`/`DELETE` grants to any role.
- Fields: `id`, `entity_type`, `entity_id`, `actor_profile_id` (nullable for system-actor events), `action`, `detail` (JSON), `occurred_at`.
- Owned by: written by the system on every meaningful state transition; read by Auditor (full) and System Administrator (operational subset); never mutated or deleted by anyone.

### `system_setting`
Configuration values (thresholds, retention periods, integration toggles) managed by System Administrator.
- Fields: `id`, `organization_id`, `key`, `value` (JSON), `updated_by_profile_id`, `updated_at`.
- Owned by: System Administrator exclusively.

### `model_registry_entry`
A versioned record of a trained model artifact, per [PRODUCTION_SCOPE.md](PRODUCTION_SCOPE.md) ML operations requirements.
- Fields: `id`, `version`, `artifact_path`, `trained_at`, `promoted_at` (nullable — set only if it passed the release gate), `is_active`.
- Owned by: written by the ML pipeline/System Administrator promotion action; read by Verifier (to see which model produced a given prediction), Auditor (full history).

### `model_evaluation`
The dated, checked-in evaluation report backing a `model_registry_entry`, per the [release gate](SUCCESS_METRICS.md#release-gate).
- Fields: `id`, `model_registry_entry_id`, `dataset_identity`, `macro_f1`, `destroyed_recall`, `calibration_error`, `evaluated_at`, `report_path` (→ `ml/reports/`).
- Owned by: written by the ML evaluation pipeline; read by Verifier (indirectly, via advisory-only flag), Auditor (full).

## Relationships (Summary)

```text
organization 1─* profile 1─* role_assignment
organization 1─* disaster_event

disaster_event 1─* report
report 1─* report_evidence
report 1─* geolocation_observation
report 1─* analysis_job 1─1 model_prediction 1─* model_explanation
report 1─* verification_review
report 1─* response_task (direct, or via incident_cluster)

disaster_event 1─* incident_cluster 1─* cluster_member 1─1 report
response_task 1─* task_assignment

profile 1─* notification
profile 1─* push_subscription

disaster_event 1─* export_job

(all entities) 1─* audit_event   — audit_event references entity_type + entity_id generically

organization 1─* system_setting
model_registry_entry 1─* model_evaluation
model_registry_entry 1─* analysis_job (via model_registry_entry_id on analysis_job)
```

## Cross-References

- [STATE_MACHINES.md](STATE_MACHINES.md) — the `report` and `response_task` state machines governing valid transitions on these entities.
- [RBAC_MATRIX.md](RBAC_MATRIX.md) — which role may create/read/update/delete/approve/export/assign/configure each entity.
- [NAVIGATION_BY_ROLE.md](NAVIGATION_BY_ROLE.md) — where each role encounters these entities in the UI.
