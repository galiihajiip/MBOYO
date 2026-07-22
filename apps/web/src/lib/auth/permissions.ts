import type { Role } from "@mboyo/domain";

/**
 * Action verbs mirroring docs/product/RBAC_MATRIX.md's legend exactly:
 * C=create, R=read, U=update, D=delete, A=approve, E=export, As=assign,
 * Co=configure.
 */
export type PermissionAction = "create" | "read" | "update" | "delete" | "approve" | "export" | "assign" | "configure";

/**
 * A permission is checked as (entity, action) — e.g. ("report", "approve")
 * for a Verifier's confirm/override/reject decision, or
 * ("response_task", "assign") for a Coordinator dispatching a task.
 *
 * This table is a direct transcription of docs/product/RBAC_MATRIX.md — if
 * that document changes, this table must change with it in the same
 * change, per the consequence recorded in docs/product/WORKING_CONTRACT.md
 * ("any new entity or action introduced later must be added to the matrix
 * before implementation, not after").
 */
const PERMISSION_TABLE: Record<string, Partial<Record<Role, boolean>>> = {
  // report: Reporter C+R(own); Verifier R(all)+A(via verification_reviews);
  // Coordinator R(verified only); Admin none (cannot validate); Auditor R.
  "report:create": { reporter: true },
  "report:read": { reporter: true, verifier: true, response_coordinator: true, auditor: true },
  "report:approve": { verifier: true },

  // report:configure — archiving a verified/rejected report is retention
  // management (AGENTS.md: System Administrator's allowed "...retention"),
  // not validation, so it's modeled under the same verb as
  // system_setting:configure/disaster_event:configure below rather than
  // introducing a 9th verb to RBAC_MATRIX.md's legend for this one case
  // (BLOCK 16 decision, see docs/product/WORKING_CONTRACT.md).
  "report:configure": { system_administrator: true },

  // report_evidence: Reporter C(own, at submit); everyone with report read
  // access also reads evidence.
  "report_evidence:create": { reporter: true },
  "report_evidence:read": { reporter: true, verifier: true, response_coordinator: true, auditor: true },

  // geolocation_observation (BLOCK 17): Reporter C(own report) + R(own);
  // Verifier R(all, per RBAC_MATRIX.md — not "verified only", that
  // restriction is Coordinator's); Coordinator R(verified only, enforced
  // by RLS geolocation_observations_coordinator_select_verified); Auditor
  // R(read-only). No role ever gets U/D — immutable after insert, a retry
  // with a better GPS fix is always a new observation row.
  "geolocation_observation:create": { reporter: true },
  "geolocation_observation:read": { reporter: true, verifier: true, response_coordinator: true, auditor: true },

  // verification_review: Verifier C(own decision) — the actual confirm/
  // override/reject/request_info/escalate action.
  "verification_review:create": { verifier: true },
  "verification_review:read": { verifier: true, response_coordinator: true, auditor: true },

  // incident_cluster / response_task / task_assignment: Coordinator
  // C/R/U/D/assign, exclusively. Admin explicitly excluded — "Admin cannot
  // validate/dispatch" acceptance criterion.
  "incident_cluster:create": { response_coordinator: true },
  "incident_cluster:update": { response_coordinator: true },
  "response_task:create": { response_coordinator: true },
  "response_task:update": { response_coordinator: true },
  "response_task:assign": { response_coordinator: true },
  "response_task:read": { verifier: true, response_coordinator: true, system_administrator: true, auditor: true },

  // export_job: Coordinator C/R(own); Auditor C/R(compliance, org-wide).
  "export_job:create": { response_coordinator: true, auditor: true },
  "export_job:read": { response_coordinator: true, system_administrator: true, auditor: true },

  // role_assignment / system_setting / disaster_event / organization:
  // System Administrator configuration domain, exclusively.
  "role_assignment:create": { system_administrator: true },
  "role_assignment:read": { system_administrator: true, auditor: true },
  "role_assignment:update": { system_administrator: true },
  "role_assignment:delete": { system_administrator: true },
  "system_setting:configure": { system_administrator: true },
  "system_setting:read": {
    reporter: true,
    verifier: true,
    response_coordinator: true,
    system_administrator: true,
    auditor: true,
  },
  "disaster_event:create": { system_administrator: true },
  "disaster_event:update": { system_administrator: true },
  "disaster_event:configure": { system_administrator: true },
  "disaster_event:read": {
    reporter: true,
    verifier: true,
    response_coordinator: true,
    system_administrator: true,
    auditor: true,
  },
  "organization:configure": { system_administrator: true },

  // profile (BLOCK 27): every role reads/updates their own (RLS-scoped —
  // profiles_select_own/profiles_update_own already enforce "own row
  // only"); System Administrator gets full C/R/U/D/Co per RBAC_MATRIX.md
  // (the "Pengguna & Role" screen's user-management surface); Auditor R
  // (read-only oversight of the user roster, never mutation).
  "profile:read": {
    reporter: true,
    verifier: true,
    response_coordinator: true,
    system_administrator: true,
    auditor: true,
  },
  "profile:update": { reporter: true, verifier: true, response_coordinator: true, system_administrator: true },
  "profile:configure": { system_administrator: true },

  // deletion_request / legal_hold (BLOCK 27 retention placeholders): any
  // authenticated role may submit their own deletion request (C, own);
  // System Administrator reviews (U) and places/releases legal holds
  // (C/U); Auditor gets read-only visibility into both, matching its
  // read-only-everywhere posture and this block's "retention/deletion
  // evidence" requirement.
  "deletion_request:create": {
    reporter: true,
    verifier: true,
    response_coordinator: true,
    system_administrator: true,
    auditor: true,
  },
  "deletion_request:read": { system_administrator: true, auditor: true },
  "deletion_request:update": { system_administrator: true },
  "legal_hold:create": { system_administrator: true },
  "legal_hold:update": { system_administrator: true },
  "legal_hold:read": { system_administrator: true, auditor: true },

  // model_registry_entry: System Administrator A(promote) only.
  "model_registry_entry:approve": { system_administrator: true },
  "model_registry_entry:read": { verifier: true, system_administrator: true, auditor: true },

  // audit_event: Auditor R only, everyone else per RBAC_MATRIX.md's
  // per-table notes; NO role — including system_administrator — ever gets
  // update/delete, and that action is deliberately absent from this table
  // entirely (requirePermission for "audit_event:update"/"delete" will
  // therefore always deny, for every role, since no entry grants it).
  "audit_event:read": { system_administrator: true, auditor: true },

  // notification (BLOCK 25): every operational role reads only their own
  // (enforced by notifications_select_own RLS — this permission entry is
  // the route-layer gate, RLS is still the actual row-visibility boundary);
  // System Administrator gets R(all) per RBAC_MATRIX.md; Auditor R(all).
  "notification:read": {
    reporter: true,
    verifier: true,
    response_coordinator: true,
    system_administrator: true,
    auditor: true,
  },

  // gemini_advisory_request (BLOCK 22): Verifier C(own request)+R only —
  // an optional, non-authoritative external advisory call, never a
  // decision record. No role other than Verifier may ever trigger this
  // (Reporter/Coordinator/Admin have zero access; Auditor gets read-only,
  // matching the read-only-everywhere Auditor pattern, so a Gemini
  // prompt/response can be reviewed after the fact per
  // docs/security/THREAT_MODEL.md's detection strategy for prompt
  // injection).
  "gemini_advisory_request:create": { verifier: true },
  "gemini_advisory_request:read": { verifier: true, auditor: true },
};

/**
 * True if the given role is permitted to perform action on entity, per the
 * table above (itself a direct transcription of RBAC_MATRIX.md).
 * Fails closed: an (entity, action) pair not present in the table denies
 * every role, rather than defaulting to allow.
 */
export function roleHasPermission(role: Role, entity: string, action: PermissionAction): boolean {
  const key = `${entity}:${action}`;
  return PERMISSION_TABLE[key]?.[role] === true;
}
