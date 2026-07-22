# MBOYO Privacy Model

BLOCK 28 deliverable. This is the internal/technical privacy model — what data is collected, why, who can see it, how long it's kept, and what mechanisms exist for a user to exercise their rights over it. The user-facing Bahasa Indonesia equivalent is [`/privacy`](../../apps/web/src/app/privacy/page.tsx) and [`/data-governance`](../../apps/web/src/app/data-governance/page.tsx) — this document is the engineering-facing source of truth those pages should stay consistent with, not a duplicate written independently.

## Purpose limitation

Every category of data MBOYO collects exists to serve one of three purposes, and nothing is collected "just in case":

| Data | Purpose | Collected by |
|---|---|---|
| Evidence photos + metadata (hash, dimensions, MIME) | Verification (human + ML-assisted) of a reported incident | Reporter, at report submission |
| GPS coordinates + accuracy | Locating the incident for verification and response dispatch | Reporter's device, at report submission |
| Report description text | Context for the Verifier's decision | Reporter |
| Display name, phone number | Attributing a report to an account; enabling Verifier/Coordinator follow-up if needed | Account registration |
| Verification decisions, response task history | The auditable lineage of what happened to a report | Verifier/Coordinator, as they act |
| Consent acceptance records (`consent_records`) | Proof that a specific account accepted a specific version of the privacy notice | This block (BLOCK 28) |

No data collection point in this codebase exists purely for analytics, advertising, or a purpose not listed above. If a future block adds a new data category, it should be added to this table alongside its purpose — a category with no stated purpose here is a signal something was added without privacy review.

## Consent versioning

Implemented this block via `consent_records` (`supabase/migrations/20260727080000_consent_records.sql`):

- One row per `(profile_id, document_key, version)` acceptance — a profile re-accepting a bumped version inserts a **new** row rather than mutating the old one, preserving full acceptance history.
- `document_key` is a closed enum (`CONSENT_DOCUMENT_KEYS` in `packages/domain/src/admin.ts`), currently just `privacy_notice` — a typo in a document key can never silently create an untracked, un-auditable "new" document.
- The current version string for each document lives in `apps/web/src/lib/consent/consent.ts`'s `CURRENT_CONSENT_VERSIONS` — bumping it is a deliberate, reviewed code change (mirrors how `model_registry_entries` versions a model rather than duplicating its weights).
- Every acceptance is recorded via the `record_consent()` RPC (`SECURITY DEFINER`, resolves the actor server-side via `current_profile_id()`), which atomically appends a `consent_record.accepted` audit event — so "every consent acceptance is audited" is a database guarantee, not application-level care.
- `ConsentGate` (`apps/web/src/components/shell/ConsentGate.tsx`), mounted once inside `AppShell` (so every authenticated role passes through it), checks `GET /api/consent` on load and blocks interaction with an overlay until the current `privacy_notice` version is accepted. This is deliberately minimal — one document, one button, no granular per-purpose toggles. A fuller consent-management UI (per-purpose opt-in/opt-out, consent withdrawal as a first-class action) is disclosed future work, not implemented here.
- `consent_records` has no `UPDATE`/`DELETE` policy for any role — an acceptance is an immutable historical fact, matching `verification_reviews`' "a correction is a new row, not an edit" precedent.

## Offline storage notice

Per [THREAT_MODEL.md](../security/THREAT_MODEL.md) threat #10 ("Offline Device Exposure"): report data (including evidence photos) queued locally before sync sits in the browser's IndexedDB, same-origin sandboxed but **not encrypted at rest by the browser** — this is an accepted trade-off of the offline-first product pillar, not a gap silently assumed safe. There is no remote-wipe capability for local IndexedDB data if a device is lost or compromised before sync. Reporter-facing guidance should disclose this (device-level security — screen lock, OS encryption — is a device-owner responsibility outside MBOYO's control).

## External Gemini disclosure

Unchanged from [ADR 0004](../adr/0004-local-ml-primary-gemini-advisory.md) and [THREAT_MODEL.md](../security/THREAT_MODEL.md) threat #8: Gemini is never enabled by default, is called only server-side from `apps/web`, and its output is never authoritative. A raw evidence image is sent to Gemini only when a Verifier explicitly requests it **and** both a consent acknowledgement and an external-cloud-disclosure acknowledgement are given for that specific call — recorded in `gemini_advisory_requests.consent_accepted`/`external_disclosure_accepted`, not inferred from a session flag or a prior request. This is a per-call disclosure distinct from the account-level `consent_records` mechanism above: accepting the general privacy notice does **not** imply consent to send a specific photo to an external model.

## Retention

- `retention.evidence_retention_days` / `retention.audit_retention_days` (`system_settings`, seeded by BLOCK 27's migration) are the **declared** policy an Auditor can read and compare against actual data age.
- **No scheduled job enforces these values** — no cron/scheduled-deletion infrastructure exists anywhere in this codebase. This is disclosed explicitly in the migration's own comment and here, not silently left as dead configuration. Building that enforcement job is tracked as later roadmap work (`docs/product/DELIVERY_ROADMAP.md`).
- `audit_events` retention is deliberately modeled as a separate declared value from evidence retention — an audit trail reasonably needs to outlive the evidence it references (e.g. proving a decision was made correctly even after the underlying photo is gone).

## Account/data request placeholder

- `deletion_requests` (BLOCK 27, `supabase/migrations/20260726070002_retention_placeholders.sql`) lets any account submit a deletion request and lets a System Administrator review (approve/deny/complete) it — with every transition audited via `review_deletion_request()`.
- **This table records the request and its review status only — it does not itself delete any data.** No trigger or scheduled job acts on an `'approved'` status. This is the same "honest, inspectable shell for future enforcement" pattern as the retention policy above, not a claim that deletion actually happens today.
- `legal_holds` exists as the counterpart placeholder: a hold recorded against a report or disaster event that a *future* retention-enforcement job would need to check before deleting anything. No enforcement mechanism reads this table yet.

## Who can see what

Restated here from the Data Governance/Privacy pages for the engineering audience, with the actual enforcement mechanism named (not just the intent):

| Role | Evidence access | Mechanism |
|---|---|---|
| Reporter | Own reports' evidence only | `report_evidence_reporter_select_own` RLS policy |
| Verifier | All evidence (for review) | `report_evidence_verifier_select` RLS policy |
| Response Coordinator | Evidence for `verified`-status reports only | `report_evidence_coordinator_select_verified` RLS policy |
| System Administrator | No evidence access by default (storage-level admin read added BLOCK 26 for operational/support purposes, not routine viewing) | `report_evidence_bucket_admin_select` storage policy |
| Auditor | All evidence (read-only, for lineage review) | `report_evidence_auditor_select` RLS policy |

Every row above is enforced by Postgres RLS, verified by pgTAP (`supabase/tests/050_rls_block28_remaining_tables.sql`), not just UI-level hiding.

## Exports

Unchanged from BLOCK 26: exports (CSV/GeoJSON/JSON) never include private evidence storage paths by default; field redaction (`applyFieldRedaction()` in `apps/web/src/lib/command/exports.ts`) can only narrow an already-safe allowlist further, never widen it. Every export is itself an audited event (`export_job.created`).

## What this document does not claim

- No automated PII detection/redaction within evidence photos themselves (see [THREAT_MODEL.md](../security/THREAT_MODEL.md) threat #9, "Sensitive Imagery") — access-gating and retention reduce exposure surface, they do not detect or obscure sensitive content within an authorized viewer's legitimate access.
- No data-residency guarantees beyond whatever Supabase's own project region provides.
- No GDPR/UU PDP formal compliance certification — this is a capstone-scope privacy model with honest mechanisms, not a legal compliance attestation.
