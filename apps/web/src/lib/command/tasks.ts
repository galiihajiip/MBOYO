import "server-only";
import type {
  AssignResponseTaskInput,
  CreateResponseTaskInput,
  SetPriorityInput,
  TaskListFilters,
  TransitionResponseTaskStatusInput,
} from "@mboyo/domain";
import type { PaginatedResult, PaginationRequest } from "@mboyo/domain";
import { buildPaginatedResult } from "@mboyo/domain";
import { ApiError } from "../api/errors";
import {
  toResponseTaskDto,
  toTaskAssignmentDto,
  type CommandDbClient,
  type ResponseTaskDto,
  type ResponseTaskRow,
  type TaskAssignmentDto,
  type TaskAssignmentRow,
} from "./types";

const PRECONDITION_FAILED_SQLSTATE = "P0001";
const NOT_FOUND_SQLSTATE = "P0002";
const INSUFFICIENT_PRIVILEGE_SQLSTATE = "42501";
const VALIDATION_FAILED_SQLSTATE = "22023";

interface PostgrestLikeError {
  code?: string;
  message: string;
}

function translateRpcError(error: PostgrestLikeError, fallbackMessage: string): never {
  if (error.code === INSUFFICIENT_PRIVILEGE_SQLSTATE) {
    throw new ApiError("forbidden", "Anda tidak memiliki izin untuk melakukan tindakan ini.");
  }
  if (error.code === NOT_FOUND_SQLSTATE) {
    throw new ApiError("not_found", "Tugas respons tidak ditemukan.");
  }
  if (error.code === VALIDATION_FAILED_SQLSTATE) {
    throw new ApiError("validation_failed", error.message);
  }
  if (error.code === PRECONDITION_FAILED_SQLSTATE) {
    throw new ApiError("invalid_transition", error.message);
  }
  throw new ApiError("internal_error", fallbackMessage);
}

/**
 * Creates a draft response_task targeting exactly one report XOR one
 * incident_cluster — all precondition validation (verified-only,
 * exactly-one-target, category required, critical priority forbidden at
 * creation) lives in create_response_task() (this block's migration); this
 * function only translates.
 */
export async function createResponseTask(
  db: CommandDbClient,
  input: CreateResponseTaskInput,
): Promise<ResponseTaskDto> {
  const { data, error } = await db
    .rpc("create_response_task", {
      p_report_id: input.reportId ?? null,
      p_incident_cluster_id: input.incidentClusterId ?? null,
      p_category: input.category,
      p_description: input.description ?? null,
      p_due_at: input.dueAt ?? null,
      p_priority: input.priority,
      p_resources: input.resources ?? null,
    })
    .single<ResponseTaskRow>();

  if (error) {
    translateRpcError(error, "Gagal membuat tugas respons.");
  }
  if (!data) {
    throw new ApiError("internal_error", "Gagal membuat tugas respons.");
  }

  return toResponseTaskDto(data);
}

/**
 * Assigns (or reassigns) a task to any profile, any role, per this block's
 * user-approved decision — assign_response_task() closes out any still-open
 * prior assignment before inserting the new one and advances draft/assigned
 * -> assigned.
 */
export async function assignResponseTask(
  db: CommandDbClient,
  taskId: string,
  input: AssignResponseTaskInput,
): Promise<ResponseTaskDto> {
  const { data, error } = await db
    .rpc("assign_response_task", { p_task_id: taskId, p_assignee_profile_id: input.assigneeProfileId })
    .single<ResponseTaskRow>();

  if (error) {
    translateRpcError(error, "Gagal menugaskan tugas respons.");
  }
  if (!data) {
    throw new ApiError("internal_error", "Gagal menugaskan tugas respons.");
  }

  return toResponseTaskDto(data);
}

/**
 * Advances a task's status — either an assignee's own
 * acknowledged/in_progress/blocked/completed transition, or a
 * Coordinator-exclusive cancellation (requires a reason), per
 * STATE_MACHINES.md's Task State Machine. All actor/transition-validity
 * enforcement lives in transition_response_task_status().
 */
export async function transitionResponseTaskStatus(
  db: CommandDbClient,
  taskId: string,
  input: TransitionResponseTaskStatusInput,
): Promise<ResponseTaskDto> {
  const { data, error } = await db
    .rpc("transition_response_task_status", {
      p_task_id: taskId,
      p_new_status: input.newStatus,
      p_reason: input.reason ?? null,
    })
    .single<ResponseTaskRow>();

  if (error) {
    translateRpcError(error, "Gagal mengubah status tugas respons.");
  }
  if (!data) {
    throw new ApiError("internal_error", "Gagal mengubah status tugas respons.");
  }

  return toResponseTaskDto(data);
}

/**
 * Sets (or changes) a task's operational priority. Critical priority
 * requires a non-empty reason — enforced by set_response_task_priority();
 * every change is audited as response_task.priority_changed.
 */
export async function setResponseTaskPriority(
  db: CommandDbClient,
  taskId: string,
  input: SetPriorityInput,
): Promise<ResponseTaskDto> {
  const { data, error } = await db
    .rpc("set_response_task_priority", {
      p_task_id: taskId,
      p_priority: input.priority,
      p_reason: input.reason ?? null,
    })
    .single<ResponseTaskRow>();

  if (error) {
    translateRpcError(error, "Gagal mengubah prioritas tugas respons.");
  }
  if (!data) {
    throw new ApiError("internal_error", "Gagal mengubah prioritas tugas respons.");
  }

  return toResponseTaskDto(data);
}

/**
 * Lists response_tasks with the Tugas Respons screen's filters — offset
 * pagination via the same buildPaginatedResult helper
 * lib/reports/service/list.ts uses. overdueOnly filters on due_at < now()
 * for non-terminal tasks, matching command_dashboard_metrics'
 * overdue_task_count definition exactly so the dashboard metric and this
 * list are always consistent with each other.
 */
export async function listResponseTasks(
  db: CommandDbClient,
  filters: TaskListFilters,
  pagination: PaginationRequest,
): Promise<PaginatedResult<ResponseTaskDto>> {
  let query = db.from("response_tasks").select("*", { count: "exact" });

  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.priority) {
    query = query.eq("priority", filters.priority);
  }
  if (filters.category) {
    query = query.ilike("category", `%${filters.category}%`);
  }
  if (filters.overdueOnly) {
    query = query.lt("due_at", new Date().toISOString()).neq("status", "completed").neq("status", "cancelled");
  }
  if (filters.assigneeProfileId) {
    const { data: assignmentRows } = await db
      .from("task_assignments")
      .select("response_task_id")
      .eq("assignee_profile_id", filters.assigneeProfileId)
      .is("unassigned_at", null)
      .returns<{ response_task_id: string }[]>();
    const taskIds = (assignmentRows ?? []).map((row) => row.response_task_id);
    query = query.in("id", taskIds.length > 0 ? taskIds : ["00000000-0000-0000-0000-000000000000"]);
  }

  const from = (pagination.page - 1) * pagination.pageSize;
  const to = from + pagination.pageSize - 1;

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to)
    .returns<ResponseTaskRow[]>();

  if (error) {
    throw new ApiError("internal_error", "Gagal memuat daftar tugas respons.");
  }

  return buildPaginatedResult((data ?? []).map(toResponseTaskDto), count ?? 0, pagination);
}

export async function getResponseTaskById(db: CommandDbClient, taskId: string): Promise<ResponseTaskDto> {
  const { data } = await db.from("response_tasks").select("*").eq("id", taskId).maybeSingle<ResponseTaskRow>();

  if (!data) {
    throw new ApiError("not_found", "Tugas respons tidak ditemukan.");
  }

  return toResponseTaskDto(data);
}

/** All task_assignments for a task, most recent first — the task detail page's assignment history. */
export async function listTaskAssignments(db: CommandDbClient, taskId: string): Promise<TaskAssignmentDto[]> {
  const { data, error } = await db
    .from("task_assignments")
    .select("*")
    .eq("response_task_id", taskId)
    .order("assigned_at", { ascending: false })
    .returns<TaskAssignmentRow[]>();

  if (error) {
    throw new ApiError("internal_error", "Gagal memuat riwayat penugasan.");
  }

  return (data ?? []).map(toTaskAssignmentDto);
}
