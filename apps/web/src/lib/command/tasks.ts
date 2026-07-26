import "server-only";
import type { CreateResponseTaskInput, PaginationRequest, PaginatedResult, TaskListFilters, TaskStatus, PriorityLevel } from "@mboyo/domain";
import { buildPaginatedResult } from "@mboyo/domain";
import { ApiError } from "../api/errors";
import type { CommandDbClient, ResponseTaskDto, ResponseTaskRow, TaskAssignmentDto, TaskAssignmentRow } from "./types";
import { toResponseTaskDto, toTaskAssignmentDto } from "./types";

export async function createResponseTask(
  db: CommandDbClient,
  input: CreateResponseTaskInput,
): Promise<ResponseTaskDto> {
  const { data, error } = await db
    .rpc("create_response_task", {
      p_report_id: input.reportId ?? null,
      p_incident_cluster_id: input.incidentClusterId ?? null,
      p_priority: input.priority,
      p_category: input.category,
      p_description: input.description,
      p_due_at: input.dueAt ?? null,
      p_resources: input.resources ?? null,
    })
    .single<ResponseTaskRow>();

  if (error || !data) {
    throw new ApiError("internal_error", "Gagal membuat tugas respons.");
  }

  return toResponseTaskDto(data);
}

export async function listResponseTasks(
  db: CommandDbClient,
  filters: TaskListFilters,
  pagination: PaginationRequest,
): Promise<PaginatedResult<ResponseTaskDto>> {
  try {
    let query = db.from("response_tasks").select("*", { count: "exact" });
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.priority) query = query.eq("priority", filters.priority);

    const from = (pagination.page - 1) * pagination.pageSize;
    const to = from + pagination.pageSize - 1;

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to)
      .returns<ResponseTaskRow[]>();

    if (!error && data) {
      return buildPaginatedResult(data.map(toResponseTaskDto), count ?? data.length, pagination);
    }
  } catch {}

  throw new ApiError("internal_error", "Gagal memuat daftar tugas respons.");
}

export async function getResponseTaskById(db: CommandDbClient, taskId: string): Promise<ResponseTaskDto> {
  try {
    const { data } = await db.from("response_tasks").select("*").eq("id", taskId).maybeSingle<ResponseTaskRow>();
    if (data) {
      return toResponseTaskDto(data);
    }
  } catch {}

  throw new ApiError("not_found", "Tugas respons tidak ditemukan.");
}

export async function assignResponseTask(
  db: CommandDbClient,
  taskId: string,
  input: { assigneeProfileId?: string; assignedProfileId?: string; notes?: string },
): Promise<TaskAssignmentDto> {
  const targetProfileId = input.assigneeProfileId ?? input.assignedProfileId ?? "";

  const { data, error } = await db
    .from("task_assignments")
    .insert({
      task_id: taskId,
      assigned_profile_id: targetProfileId,
      notes: input.notes ?? null,
    })
    .select()
    .single<TaskAssignmentRow>();

  if (error || !data) {
    throw new ApiError("internal_error", "Gagal menetapkan tugas respons.");
  }

  return toTaskAssignmentDto(data);
}

export async function setResponseTaskPriority(
  db: CommandDbClient,
  taskId: string,
  priority: PriorityLevel,
): Promise<ResponseTaskDto> {
  const { data, error } = await db
    .from("response_tasks")
    .update({ priority })
    .eq("id", taskId)
    .select()
    .single<ResponseTaskRow>();

  if (error || !data) {
    throw new ApiError("internal_error", "Gagal memperbarui prioritas tugas.");
  }

  return toResponseTaskDto(data);
}

export async function transitionResponseTaskStatus(
  db: CommandDbClient,
  taskId: string,
  status: TaskStatus,
): Promise<ResponseTaskDto> {
  const { data, error } = await db
    .from("response_tasks")
    .update({ status })
    .eq("id", taskId)
    .select()
    .single<ResponseTaskRow>();

  if (error || !data) {
    throw new ApiError("internal_error", "Gagal memperbarui status tugas.");
  }

  return toResponseTaskDto(data);
}

export async function listTaskAssignments(db: CommandDbClient, taskId: string): Promise<TaskAssignmentDto[]> {
  try {
    const { data, error } = await db
      .from("task_assignments")
      .select("*")
      .eq("task_id", taskId)
      .order("assigned_at", { ascending: false })
      .returns<TaskAssignmentRow[]>();

    if (!error && data) {
      return data.map(toTaskAssignmentDto);
    }
  } catch {}

  throw new ApiError("internal_error", "Gagal memuat riwayat penugasan.");
}
