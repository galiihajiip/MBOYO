# MBOYO RBAC Matrix

This document translates the role definitions in [AGENTS.md](../../AGENTS.md) into a concrete entity × action matrix, covering all 22 entities from [DOMAIN_MODEL.md](DOMAIN_MODEL.md). It is the reference for RLS policy design in a later block ([DELIVERY_ROADMAP.md](DELIVERY_ROADMAP.md) Phase 0, BLOCK 03/04 boundary).

Actions: **C**reate, **R**ead, **U**pdate, **D**elete, **A**pprove (a decision that changes state authoritatively — verification decisions, model promotion), **E**xport, **As**sign, **Co**nfigure.

Legend: `✔` = allowed, `–` = forbidden, `own` = allowed only on records the actor owns/authored, `read-only` = R only regardless of other columns.

## Matrix

| Entity | Reporter | Verifier | Response Coordinator | System Administrator | Auditor |
|---|---|---|---|---|---|
| `organization` | R | R | R | C/R/U/Co | R |
| `profile` | R (own), U (own) | R (own), U (own) | R (own), U (own) | C/R/U/D/Co | R |
| `role_assignment` | R (own) | R (own) | R (own) | C/R/U/D | R |
| `disaster_event` | R | R | R | C/R/U/Co | R |
| `report` | C, R (own) | R (all), no direct U | R (verified only) | Co (archive only — retention, not validate) | R (read-only) |
| `report_evidence` | C (own report, at submit only) | R | R (verified only) | – | R (read-only) |
| `geolocation_observation` | C (own report) | R | R (verified only) | – | R (read-only) |
| `analysis_job` | – | R | R (verified only) | R (health/status only) | R (read-only) |
| `model_prediction` | – | R | R (verified only) | R | R (read-only) |
| `model_explanation` | – | R | R (verified only) | R | R (read-only) |
| `verification_review` | – | C (own decision), R | R | – | R (read-only) |
| `incident_cluster` | – | R | C/R/U/D, As | R | R (read-only) |
| `cluster_member` | – | R | C/R/D | R | R (read-only) |
| `response_task` | – | R (verified reports only) | C/R/U, As | R | R (read-only) |
| `task_assignment` | – | – | C/R/U/D, As | R | R (read-only) |
| `notification` | R (own) | R (own) | R (own) | R (all, Co: templates) | R (read-only) |
| `push_subscription` | C/D (own) | C/D (own) | C/D (own) | R | – |
| `export_job` | – | – | C/R (own event) | R | R/E (compliance export) |
| `audit_event` | – | – | – | R (operational subset) | R (full), **read-only** |
| `system_setting` | R (public subset) | R (public subset) | R (public subset) | C/R/U/Co | R |
| `model_registry_entry` | – | R | – | A (promote) | R (read-only) |
| `model_evaluation` | – | R | – | R | R (read-only) |
| `gemini_advisory_request` | – | C (own request), R | – | – | R (read-only) |

## Notes Per Role

### Reporter
- Creates and reads only their own `report`, `report_evidence`, `geolocation_observation`, `push_subscription`.
- Never reads another Reporter's report content (RLS-enforced ownership, not just UI hiding, per [AGENTS.md](../../AGENTS.md)).
- Has zero access to `analysis_job`, `model_prediction`, `model_explanation`, `verification_review`, `response_task`, `task_assignment`, `export_job`, `audit_event`, `model_registry_entry`, `model_evaluation` — consistent with the Reporter's forbidden list ("view private reports from others," "validate AI," "set priority," "dispatch tasks," "configure system").

### Verifier
- Read access spans all reports (needed to review evidence, quality, duplicates, per [AGENTS.md](../../AGENTS.md)), but the only entities a Verifier can **create** are `verification_review` (the human decision record itself) and `gemini_advisory_request` (an optional, non-authoritative external advisory call — BLOCK 22; never a decision record, and creating one has zero effect on `report.status` or any `verification_review`).
- No `U`/`D` on `report`, `report_evidence`, `geolocation_observation`, `model_prediction` — the Verifier's decision is additive (a new `verification_review` row), never a mutation of the evidence or model output it's reviewing, satisfying "Verifier cannot change original evidence or model probabilities" implicitly (it's Coordinator's forbidden item in [AGENTS.md](../../AGENTS.md), and applies equally here by design — no role mutates evidence/predictions post-creation).
- No access to `incident_cluster`, `response_task`, `task_assignment`, `export_job` — dispatch and priority remain exclusively Coordinator's, matching "Forbidden: dispatch resources, change operational priority" for Verifier.
- No `Co` on `system_setting`, no `U`/`D` on `role_assignment` — matching "Forbidden: manage roles/settings."
- No access to `audit_event` beyond what's visible through normal entity reads — Verifier does not get a dedicated audit view; that's Auditor/System Administrator territory, matching "Forbidden: delete audit history" (Verifier has no audit_event access at all, stronger than merely forbidding deletion).

### Response Coordinator
- Reads only **verified** (or escalated) reports and their associated evidence/predictions/reviews — never `draft_local`/`queued_offline`/unverified reports, since Coordinator's authority begins at verification per [AGENTS.md](../../AGENTS.md) ("View verified/escalated incidents").
- Full C/R/U/D + assign on `incident_cluster`, `cluster_member`, `response_task`, `task_assignment` — this is the Coordinator's owned domain.
- No `U`/`D` on `report`, `report_evidence`, `verification_review`, `model_prediction` — matching "Forbidden: change original evidence... change verifier decisions or model probabilities."
- `E` (export) only on `export_job`, scoped to operational data for events the Coordinator has access to — matching "Create, assign, and track response tasks... Export operational data."
- No `role_assignment`, `system_setting` mutation — matching "Forbidden: manage users/settings."

### System Administrator
- Full `C/R/U/D/Co` on `organization`, `profile`, `role_assignment`, `disaster_event`, `system_setting` — this is the configuration domain per [AGENTS.md](../../AGENTS.md) ("Manage users, role assignments, events, integrations, thresholds, retention").
- Explicitly **no** `C`/`A` on `report` (cannot validate), **no** access to `verification_review` creation, **no** `C`/`U`/As on `response_task`/`task_assignment`/`incident_cluster` (cannot dispatch) — this is the concrete enforcement of "Forbidden by default: validate reports, dispatch response tasks."
- The one `report` mutation System Administrator CAN perform is archiving a `verified`/`rejected` report (`Co`, not `A`) — modeled as retention management ("...retention" in the Allowed list above), not a validation decision; it is only ever reachable from a terminal `verified`/`rejected` status (never `analysis_completed`/`needs_manual_review`), so it cannot be used to bypass or shortcut a Verifier's decision. See [STATE_MACHINES.md](STATE_MACHINES.md)'s `verified/rejected → archived` transition and [REPORTS_API.md](../api/REPORTS_API.md).
- `A` (approve) only on `model_registry_entry` — promoting a model from candidate to served version, gated by the release criteria in [SUCCESS_METRICS.md](SUCCESS_METRICS.md), which is a configuration/operations action, not a classification decision.
- **No** `U`/`D` on `audit_event` at all — matching "Forbidden: edit or delete audit events." System Administrator's `R` is scoped to an "operational subset" (e.g., service-health-relevant events) rather than the full lineage view Auditor gets, keeping the two roles' read scopes distinct even though both are read-heavy.

### Auditor
- **Read-only across every single entity** — no `C`/`U`/`D`/`A`/`As`/`Co` anywhere in this matrix. The one `E` (export) is for compliance-export generation, which itself only reads and packages existing data; it does not mutate anything.
- Explicitly has full, unscoped `R` on `audit_event`, `model_registry_entry`, `model_evaluation` — these are the entities central to the Auditor's lineage/compliance purpose per [AGENTS.md](../../AGENTS.md) ("Read audit lineage, reports, model registry, evaluations, external advisory usage, exports, retention evidence").
- Has **no** `push_subscription` row of their own listed as mutable (`–`) — Auditor's role is oversight, not operational participation in notification workflows; if an Auditor needs alerts this would be a distinct, explicitly-scoped future capability, not assumed here.

## Acceptance Criteria Verification

- **Mutation ownership never overlaps accidentally:** each mutating entity (`report`, `verification_review`, `response_task`, `role_assignment`, `model_registry_entry`, etc.) has exactly one role with `C` (or `A` for approval-type actions) in the matrix above, except entities that are legitimately self-service across roles (`profile` own-record update, `push_subscription` own-record C/D, `notification` own-record read) — those overlaps are intentional (each person manages their own account-level records) and do not cross into another role's domain authority.
- **Auditor is read-only:** verified above — every cell for Auditor is either `R`, `R (full)`, `R (read-only)`, or the one bounded `E` (compliance export, itself non-mutating).
- **Admin cannot validate or dispatch by default:** verified above — System Administrator has no `C`/`A` on `report`/`verification_review` (validate) and no `C`/`U`/`As` on `response_task`/`task_assignment`/`incident_cluster` (dispatch).
