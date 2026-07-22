/**
 * Core enums shared across apps/web, apps/ml-api (via packages/api-client),
 * and apps/worker's TypeScript-facing contracts. Source of truth: docs/product/STATE_MACHINES.md
 * and docs/product/DOMAIN_MODEL.md — keep these in lockstep with those documents.
 */

export const REPORT_STATUSES = [
  "draft_local",
  "queued_offline",
  "syncing",
  "submitted",
  "evidence_uploaded",
  "analysis_queued",
  "analysis_running",
  "analysis_completed",
  "needs_manual_review",
  "verified",
  "rejected",
  "archived",
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const TASK_STATUSES = [
  "draft",
  "assigned",
  "acknowledged",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PRIORITY_LEVELS = [
  "unassigned",
  "low",
  "medium",
  "high",
  "critical",
] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

export const SEVERITY_CLASSES = [
  "unknown",
  "no_damage",
  "minor_damage",
  "major_damage",
  "destroyed",
] as const;
export type SeverityClass = (typeof SEVERITY_CLASSES)[number];

export const VERIFICATION_DECISIONS = [
  "confirm",
  "override",
  "reject",
  "request_info",
  "escalate",
  "insufficient_evidence",
] as const;
export type VerificationDecision = (typeof VERIFICATION_DECISIONS)[number];

/**
 * Structured reject reason (BLOCK 23) — required iff decision='reject',
 * mirrors public.verification_reject_reason (supabase/migrations/20260722070000_verifier_review_schema.sql).
 */
export const VERIFICATION_REJECT_REASONS = [
  "insufficient_evidence",
  "not_disaster_related",
  "duplicate_report",
  "fraudulent_or_spam",
  "outside_event_boundary",
  "other",
] as const;
export type VerificationRejectReason = (typeof VERIFICATION_REJECT_REASONS)[number];

export const ROLES = [
  "reporter",
  "verifier",
  "response_coordinator",
  "system_administrator",
  "auditor",
] as const;
export type Role = (typeof ROLES)[number];

export const ANALYSIS_JOB_STATUSES = [
  "queued",
  "processing",
  "done",
  "failed",
] as const;
export type AnalysisJobStatus = (typeof ANALYSIS_JOB_STATUSES)[number];

/**
 * Structured error codes for the evidence upload endpoint (BLOCK 15,
 * docs/security/THREAT_MODEL.md threat #7). Every rejection path returns one
 * of these — never a raw/ad hoc message alone — so the offline sync-replay
 * logic (apps/web/src/lib/offline/sync-replay.ts) and any future caller can
 * classify permanent-vs-retryable without string-matching an error message.
 */
export const EVIDENCE_ERROR_CODES = [
  "unauthenticated",
  "report_not_found",
  "report_not_owned",
  "event_not_found",
  "event_not_active",
  "missing_file",
  "mime_not_allowed",
  "magic_bytes_mismatch",
  "file_too_large",
  "resolution_too_low",
  "decode_failed",
  "storage_upload_failed",
  "metadata_persist_failed",
  "rate_limited",
  "internal_error",
] as const;
export type EvidenceErrorCode = (typeof EVIDENCE_ERROR_CODES)[number];

/**
 * How a geolocation_observation was obtained (BLOCK 17) — mirrors
 * public.location_source (supabase/migrations/20260717043726_location_trust.sql).
 * Set explicitly by the client at capture time, never inferred after the
 * fact.
 */
export const LOCATION_SOURCES = ["gps", "manual_pin", "manual_address"] as const;
export type LocationSource = (typeof LOCATION_SOURCES)[number];

/**
 * Escalation/notification severity levels (BLOCK 25) — mirrors
 * public.notifications.level's check constraint
 * (supabase/migrations/20260724050001_notification_dedup_and_rpcs.sql).
 * Distinct from SeverityClass (model prediction) and PriorityLevel
 * (operational task/cluster priority) — this is specifically the urgency
 * of a notification/escalation event itself.
 */
export const NOTIFICATION_LEVELS = ["info", "warning", "high", "critical"] as const;
export type NotificationLevel = (typeof NOTIFICATION_LEVELS)[number];

/**
 * The 6 escalation rule types this block implements — mirrors the `type`
 * column values evaluate_escalations() (BLOCK 25 migration) writes, and
 * the escalation.* system_settings key suffixes an Admin configures via
 * /admin/eskalasi. `notifications.type` itself is a free-text column (no
 * DB enum — see that migration's own comment on why), so this union is
 * the TypeScript-side taxonomy convention, validated at the API boundary.
 */
export const ESCALATION_RULE_TYPES = [
  "verified_destroyed_threshold",
  "cluster_destroyed_radius",
  "verifier_sla_breach",
  "task_overdue",
  "repeated_duplicate_source",
  "repeated_analysis_failure",
] as const;
export type EscalationRuleType = (typeof ESCALATION_RULE_TYPES)[number];

/** Mirrors public.disaster_event_status (supabase/migrations/20260716153709_core_schema.sql). */
export const DISASTER_EVENT_STATUSES = ["active", "closed"] as const;
export type DisasterEventStatus = (typeof DISASTER_EVENT_STATUSES)[number];

/**
 * Retention placeholders (BLOCK 27) — mirror
 * public.deletion_request_status (supabase/migrations/20260726070002_retention_placeholders.sql).
 * These are a workflow-tracking placeholder, not a working scheduled
 * deletion job — see that migration's own comment.
 */
export const DELETION_REQUEST_STATUSES = ["pending", "approved", "denied", "completed"] as const;
export type DeletionRequestStatus = (typeof DELETION_REQUEST_STATUSES)[number];
