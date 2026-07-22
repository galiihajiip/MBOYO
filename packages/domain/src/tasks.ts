import { z } from "zod";
import { PRIORITY_LEVELS, TASK_STATUSES } from "./enums";

/**
 * Shared Zod schemas for the Coordinator Command Center's write commands
 * (BLOCK 24) — mirrors reports.ts's own "shared schema, imported by both
 * route handlers and domain-service functions" pattern. Each schema's
 * validation rules are deliberately a strict subset of what its matching
 * Postgres RPC (supabase/migrations/20260723060000_command_cluster_task_rpcs.sql,
 * .../20260723060001_command_priority_rpcs.sql) also enforces — this is
 * defense-in-depth, not the sole enforcement point; the RPC is what
 * actually guarantees correctness under concurrent access.
 */

// ============================================================================
// incident_cluster commands
// ============================================================================

export const createIncidentClusterSchema = z.object({
  disasterEventId: z.string().uuid(),
  label: z.string().min(1).max(200),
  reportIds: z.array(z.string().uuid()).min(1),
});
export type CreateIncidentClusterInput = z.infer<typeof createIncidentClusterSchema>;

export const addReportsToClusterSchema = z.object({
  reportIds: z.array(z.string().uuid()).min(1),
});
export type AddReportsToClusterInput = z.infer<typeof addReportsToClusterSchema>;

// ============================================================================
// response_task commands
// ============================================================================

export const createResponseTaskSchema = z
  .object({
    reportId: z.string().uuid().optional(),
    incidentClusterId: z.string().uuid().optional(),
    category: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    dueAt: z.string().datetime().optional(),
    priority: z.enum(PRIORITY_LEVELS).default("unassigned"),
    resources: z.string().max(2000).optional(),
  })
  .refine((value) => (value.reportId !== undefined) !== (value.incidentClusterId !== undefined), {
    message: "Isi salah satu: reportId atau incidentClusterId, tidak keduanya.",
    path: ["reportId"],
  })
  .refine((value) => value.priority !== "critical", {
    message: "Prioritas kritis tidak dapat diisi saat pembuatan tugas — ubah prioritas setelah tugas dibuat, dengan alasan.",
    path: ["priority"],
  });
export type CreateResponseTaskInput = z.infer<typeof createResponseTaskSchema>;

export const assignResponseTaskSchema = z.object({
  assigneeProfileId: z.string().uuid(),
});
export type AssignResponseTaskInput = z.infer<typeof assignResponseTaskSchema>;

export const transitionResponseTaskStatusSchema = z
  .object({
    newStatus: z.enum(TASK_STATUSES),
    reason: z.string().max(2000).optional(),
  })
  .refine((value) => (value.newStatus === "cancelled" ? value.reason !== undefined && value.reason.length > 0 : true), {
    message: "Alasan wajib diisi untuk membatalkan tugas.",
    path: ["reason"],
  });
export type TransitionResponseTaskStatusInput = z.infer<typeof transitionResponseTaskStatusSchema>;

// ============================================================================
// priority commands (response_task and incident_cluster share the same shape)
// ============================================================================

export const setPrioritySchema = z
  .object({
    priority: z.enum(PRIORITY_LEVELS),
    reason: z.string().max(2000).optional(),
  })
  .refine((value) => (value.priority === "critical" ? value.reason !== undefined && value.reason.length > 0 : true), {
    message: "Alasan wajib diisi untuk menetapkan prioritas kritis.",
    path: ["reason"],
  });
export type SetPriorityInput = z.infer<typeof setPrioritySchema>;

// ============================================================================
// list filters — Tugas Respons list
// ============================================================================

export const taskListFiltersSchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITY_LEVELS).optional(),
  category: z.string().max(200).optional(),
  assigneeProfileId: z.string().uuid().optional(),
  overdueOnly: z.boolean().optional(),
});
export type TaskListFilters = z.infer<typeof taskListFiltersSchema>;

// ============================================================================
// export command
// ============================================================================

/** csv | geojson | json (BLOCK 26 added json) — mirrors export_jobs.format's check constraint exactly. */
export const EXPORT_FORMATS = ["csv", "geojson", "json"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const createExportJobSchema = z.object({
  disasterEventId: z.string().uuid(),
  format: z.enum(EXPORT_FORMATS),
  filterCriteria: z.record(z.string(), z.unknown()).optional().default({}),
  /** Field redaction — omits any field not in this allowlist from the exported rows, per this block's "field redaction" requirement. Omitted entirely (undefined) means "export every field this format already includes." */
  fields: z.array(z.string()).optional(),
});
export type CreateExportJobInput = z.infer<typeof createExportJobSchema>;
