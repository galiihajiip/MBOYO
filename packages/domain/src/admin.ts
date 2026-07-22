import { z } from "zod";
import { DELETION_REQUEST_STATUSES, DISASTER_EVENT_STATUSES, ROLES } from "./enums";

/**
 * Shared Zod schemas for BLOCK 27's Admin-portal write commands (users/
 * roles, disaster events, retention placeholders) — same "shared schema
 * imported by both route handlers and domain-service functions"
 * convention as reports.ts/tasks.ts/notifications.ts.
 */

// ============================================================================
// role management
// ============================================================================

export const grantRoleSchema = z.object({
  profileId: z.string().uuid(),
  role: z.enum(ROLES),
});
export type GrantRoleInput = z.infer<typeof grantRoleSchema>;

export const revokeRoleSchema = z.object({
  profileId: z.string().uuid(),
  role: z.enum(ROLES),
});
export type RevokeRoleInput = z.infer<typeof revokeRoleSchema>;

// ============================================================================
// disaster event management
// ============================================================================

export const createDisasterEventSchema = z.object({
  name: z.string().min(1).max(200),
  geofenceGeoJson: z.string().optional(),
  startsAt: z.string().datetime().optional(),
});
export type CreateDisasterEventInput = z.infer<typeof createDisasterEventSchema>;

export const updateDisasterEventSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(DISASTER_EVENT_STATUSES).optional(),
  geofenceGeoJson: z.string().optional(),
  endsAt: z.string().datetime().optional(),
});
export type UpdateDisasterEventInput = z.infer<typeof updateDisasterEventSchema>;

// ============================================================================
// retention placeholders
// ============================================================================

export const createDeletionRequestSchema = z.object({
  subjectReportId: z.string().uuid().optional(),
  reason: z.string().min(1).max(2000),
});
export type CreateDeletionRequestInput = z.infer<typeof createDeletionRequestSchema>;

export const reviewDeletionRequestSchema = z.object({
  status: z.enum(DELETION_REQUEST_STATUSES).refine((value) => value !== "pending", {
    message: "Status tidak dapat dikembalikan ke pending.",
  }),
  reviewNotes: z.string().max(2000).optional(),
});
export type ReviewDeletionRequestInput = z.infer<typeof reviewDeletionRequestSchema>;

export const placeLegalHoldSchema = z
  .object({
    reportId: z.string().uuid().optional(),
    disasterEventId: z.string().uuid().optional(),
    reason: z.string().min(1).max(2000),
  })
  .refine((value) => (value.reportId !== undefined) !== (value.disasterEventId !== undefined), {
    message: "Isi salah satu: reportId atau disasterEventId, tidak keduanya.",
    path: ["reportId"],
  });
export type PlaceLegalHoldInput = z.infer<typeof placeLegalHoldSchema>;

export const retentionPolicySchema = z.object({
  enabled: z.boolean(),
  days: z.number().int().min(1).max(3650),
});
export type RetentionPolicyValue = z.infer<typeof retentionPolicySchema>;

// ============================================================================
// consent versioning (BLOCK 28)
// ============================================================================

/**
 * The only consent documents this app currently asks a user to accept — a
 * closed set (not a free-text key) so a typo in a document_key can never
 * silently create an untracked, un-auditable "new" consent document.
 * docs/product/PRIVACY_MODEL.md is the source of truth for each document's
 * actual copy/version history; this const only names which documents exist.
 */
export const CONSENT_DOCUMENT_KEYS = ["privacy_notice"] as const;
export type ConsentDocumentKey = (typeof CONSENT_DOCUMENT_KEYS)[number];

export const recordConsentSchema = z.object({
  documentKey: z.enum(CONSENT_DOCUMENT_KEYS),
});
export type RecordConsentInput = z.infer<typeof recordConsentSchema>;
