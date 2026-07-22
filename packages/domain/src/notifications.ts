import { z } from "zod";
import { ESCALATION_RULE_TYPES, NOTIFICATION_LEVELS } from "./enums";

/**
 * Shared Zod schemas for BLOCK 25's notification/escalation/push-subscription
 * surfaces — same "shared schema imported by both route handlers and
 * domain-service functions" convention as reports.ts/tasks.ts.
 */

// ============================================================================
// escalation settings — each escalation.* system_settings row's value shape.
// Validated per-rule since each rule has a different threshold shape; an
// Admin's PUT to /api/admin/escalation-settings/[ruleType] is validated
// against the matching schema below before being written.
// ============================================================================

const baseEscalationSettingFields = { enabled: z.boolean(), level: z.enum(NOTIFICATION_LEVELS) };

export const escalationSettingSchemas = {
  verified_destroyed_threshold: z.object({
    ...baseEscalationSettingFields,
    minProbability: z.number().min(0).max(1),
  }),
  cluster_destroyed_radius: z.object({
    ...baseEscalationSettingFields,
    minCount: z.number().int().min(2),
    radiusMeters: z.number().positive(),
    windowHours: z.number().positive(),
  }),
  verifier_sla_breach: z.object({
    ...baseEscalationSettingFields,
    hoursSinceSubmission: z.number().positive(),
  }),
  task_overdue: z.object(baseEscalationSettingFields),
  repeated_duplicate_source: z.object({
    ...baseEscalationSettingFields,
    minCount: z.number().int().min(2),
    windowHours: z.number().positive(),
  }),
  repeated_analysis_failure: z.object({
    ...baseEscalationSettingFields,
    minFailures: z.number().int().min(2),
    windowHours: z.number().positive(),
  }),
} as const satisfies Record<(typeof ESCALATION_RULE_TYPES)[number], z.ZodTypeAny>;

export type EscalationSettingValue = {
  [K in keyof typeof escalationSettingSchemas]: z.infer<(typeof escalationSettingSchemas)[K]>;
};

export const updateEscalationSettingSchema = z.object({
  ruleType: z.enum(ESCALATION_RULE_TYPES),
  value: z.record(z.string(), z.unknown()),
});
export type UpdateEscalationSettingInput = z.infer<typeof updateEscalationSettingSchema>;

// ============================================================================
// notifications — list filters + mark-read command.
// ============================================================================

export const notificationListFiltersSchema = z.object({
  unreadOnly: z.boolean().optional(),
});
export type NotificationListFilters = z.infer<typeof notificationListFiltersSchema>;

// ============================================================================
// push subscriptions — the Web Push subscription object shape a browser's
// PushManager.subscribe() returns, per the Push API spec (endpoint + a
// keys object with p256dh/auth).
// ============================================================================

export const pushSubscriptionKeysSchema = z.object({
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});

export const createPushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: pushSubscriptionKeysSchema,
});
export type CreatePushSubscriptionInput = z.infer<typeof createPushSubscriptionSchema>;

export const deletePushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
});
export type DeletePushSubscriptionInput = z.infer<typeof deletePushSubscriptionSchema>;
