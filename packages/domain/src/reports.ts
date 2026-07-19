import { z } from "zod";
import {
  REPORT_STATUSES,
  VERIFICATION_DECISIONS,
  VERIFICATION_REJECT_REASONS,
  SEVERITY_CLASSES,
  LOCATION_SOURCES,
} from "./enums";

/**
 * Shared Zod schemas for the report BFF/domain-service layer (BLOCK 16) —
 * imported by both apps/web's route handlers (request validation) and its
 * domain-service functions (so a service function's input type can never
 * drift from what the route actually validated), and available to any
 * future typed client the same way packages/api-client's ml-api schemas
 * are. Kept in packages/domain (not apps/web-local) specifically so it can
 * be imported without pulling in any Next.js/server-only code.
 */

// ============================================================================
// create report
// ============================================================================
// Mirrors apps/web/src/app/api/reports/route.ts's existing submitReportSchema
// (BLOCK 13/14) — moved here as the shared source of truth per this block's
// "shared Zod schemas" requirement; that route now imports this instead of
// defining its own copy.

export const createReportSchema = z.object({
  clientReportId: z.string().uuid(),
  eventId: z.string().uuid(),
  description: z.string().max(4000).optional().default(""),
  createdAtClient: z.string().datetime().optional(),
});
export type CreateReportInput = z.infer<typeof createReportSchema>;

// ============================================================================
// list filters — shared across own-list, verifier queue, coordinator
// operational list (each route narrows which fields it actually accepts,
// but the underlying shape/parsing is common).
// ============================================================================

export const reportStatusFilterSchema = z.enum(REPORT_STATUSES);

export const reportListFiltersSchema = z.object({
  status: reportStatusFilterSchema.optional(),
  eventId: z.string().uuid().optional(),
  /** Free-text search over description — narrow, not a full-text index requirement for this block's scope. */
  search: z.string().max(200).optional(),
  // ==========================================================================
  // Antrean Verifikasi queue filters (BLOCK 23) — every one optional; a
  // caller supplying none gets the same unfiltered list this schema already
  // produced before this block. Ranges are inclusive on both ends.
  // ==========================================================================
  /** Filters on the LATEST model_predictions row's top predicted severity class. */
  predictedSeverity: z.enum(SEVERITY_CLASSES).optional(),
  /** Minimum top-class confidence (0..1) from the latest model_predictions row. */
  minConfidence: z.number().min(0).max(1).optional(),
  /** Maximum top-class confidence (0..1) — paired with minConfidence to express an "uncertain" band (e.g. 0.3-0.6). */
  maxConfidence: z.number().min(0).max(1).optional(),
  /** Maximum model_predictions.quality_score — filters TO low-quality reports (a queue triage filter), not a floor. */
  maxQualityScore: z.number().min(0).max(1).optional(),
  /** True: only reports whose latest model_predictions row has a duplicate_candidate_report_id set. */
  hasDuplicateCandidate: z.boolean().optional(),
  /** Maximum geolocation_observations.accuracy_meters (larger = worse GPS fix) — filters TO poor-accuracy reports. */
  maxGpsAccuracyMeters: z.number().min(0).optional(),
  /** Minimum report age in hours since submission — an SLA/staleness filter. */
  minAgeHours: z.number().min(0).optional(),
  /** True: only reports with an unresolved escalate decision (reports.escalated). */
  escalatedOnly: z.boolean().optional(),
  /** Verifier profile id — "assigned to me" style filter. Assignment itself is out of this block's scope (no assignee column exists); this filters on verification_reviews.verifier_profile_id (i.e. "reports I've already reviewed"), see lib/reports/service/list.ts's doc comment for the honest limitation this implies. */
  reviewedByVerifierProfileId: z.string().uuid().optional(),
});
export type ReportListFilters = z.infer<typeof reportListFiltersSchema>;

// ============================================================================
// verification decision (the ONLY way a report's status may move out of
// analysis_completed/needs_manual_review — see docs/product/STATE_MACHINES.md).
// This is the "domain command" the prompt requires in place of an arbitrary
// status-update endpoint: the caller submits a decision, never a target
// status directly.
// ============================================================================

export const submitVerificationDecisionSchema = z
  .object({
    decision: z.enum(VERIFICATION_DECISIONS),
    overrideSeverity: z.enum(SEVERITY_CLASSES).optional(),
    rejectReasonCategory: z.enum(VERIFICATION_REJECT_REASONS).optional(),
    notes: z.string().max(4000).optional(),
  })
  .refine((value) => (value.decision === "override" ? value.overrideSeverity !== undefined : true), {
    message: "overrideSeverity wajib diisi ketika keputusan adalah override.",
    path: ["overrideSeverity"],
  })
  .refine((value) => (value.decision !== "override" ? value.overrideSeverity === undefined : true), {
    message: "overrideSeverity hanya boleh diisi ketika keputusan adalah override.",
    path: ["overrideSeverity"],
  })
  .refine((value) => (value.decision === "reject" ? value.rejectReasonCategory !== undefined : true), {
    message: "rejectReasonCategory wajib diisi ketika keputusan adalah reject.",
    path: ["rejectReasonCategory"],
  })
  .refine((value) => (value.decision !== "reject" ? value.rejectReasonCategory === undefined : true), {
    message: "rejectReasonCategory hanya boleh diisi ketika keputusan adalah reject.",
    path: ["rejectReasonCategory"],
  })
  .refine(
    (value) => (value.decision === "override" || value.decision === "reject" ? value.notes !== undefined && value.notes.length > 0 : true),
    {
      message: "Catatan wajib diisi untuk override atau reject.",
      path: ["notes"],
    },
  )
  .refine((value) => (value.decision === "escalate" ? value.notes !== undefined && value.notes.length > 0 : true), {
    message: "Catatan wajib diisi untuk eskalasi.",
    path: ["notes"],
  });
export type SubmitVerificationDecisionInput = z.infer<typeof submitVerificationDecisionSchema>;

// ============================================================================
// archive command
// ============================================================================

export const archiveReportSchema = z.object({
  reason: z.string().max(1000).optional(),
});
export type ArchiveReportInput = z.infer<typeof archiveReportSchema>;

// ============================================================================
// location capture (BLOCK 17) — one report may carry several observations
// over time (a Reporter retrying GPS for a better fix), per
// docs/product/DOMAIN_MODEL.md's geolocation_observation entity design —
// this schema validates ONE observation, POSTed once per capture/retry/pin
// placement, not the report's "final" location as a single mutable field.
//
// Longitude/latitude are validated to their real-world ranges here (not
// just "is a number") specifically because record_geolocation_observation()
// (the Postgres function this schema's parsed output is passed to) also
// range-checks and raises a Postgres exception on failure — catching an
// out-of-range value here, before any network round-trip, gives a much
// clearer validation_failed/fieldErrors response than surfacing a raw SQL
// exception message would.
// ============================================================================

export const submitLocationObservationSchema = z
  .object({
    longitude: z.number().min(-180).max(180),
    latitude: z.number().min(-90).max(90),
    accuracyMeters: z.number().positive().optional(),
    capturedAtClient: z.string().datetime().optional(),
    source: z.enum(LOCATION_SOURCES),
    manualAddress: z.string().max(500).optional(),
  })
  .refine((value) => (value.source === "manual_address" ? Boolean(value.manualAddress?.trim()) : true), {
    message: "Alamat wajib diisi ketika sumber lokasi adalah alamat manual.",
    path: ["manualAddress"],
  });
export type SubmitLocationObservationInput = z.infer<typeof submitLocationObservationSchema>;
