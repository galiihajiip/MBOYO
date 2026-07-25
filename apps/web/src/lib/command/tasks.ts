import "server-only";
import type { CreateResponseTaskInput, PaginationRequest, PaginatedResult, ResponseTaskFilters, TaskStatus, TaskPriority } from "@mboyo/domain";
import { buildPaginatedResult } from "@mboyo/domain";
import { ApiError } from "../api/errors";
import type { CommandDbClient, ResponseTaskDto, ResponseTaskRow, TaskAssignmentDto, TaskAssignmentRow } from "./types";
import { toResponseTaskDto, toTaskAssignmentDto } from "./types";

export async function createResponseTask(
  db: CommandDbClient,
  input: CreateResponseTaskInput,
): Promise<ResponseTaskDto> {
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    return {
      id: `demo-task-${Date.now()}`,
      reportId: input.reportId ?? null,
      incidentClusterId: input.incidentClusterId ?? null,
      status: "assigned",
      priority: input.priority,
      createdByProfileId: "demo-coordinator",
      category: input.category,
      description: input.description,
      dueAt: input.dueAt ?? null,
      resources: input.resources ?? null,
      createdAt: new Date().toISOString(),
      closedAt: null,
    };
  }

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
  filters: ResponseTaskFilters,
  pagination: PaginationRequest,
): Promise<PaginatedResult<ResponseTaskDto>> {
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    const demoItems: ResponseTaskDto[] = [
      {
        id: "demo-task-1",
        reportId: "demo-report-1",
        incidentClusterId: "demo-cluster-1",
        status: "in_progress",
        priority: "critical",
        createdByProfileId: "demo-coordinator",
        category: "Evakuasi Korban & Pembersihan Reruntuhan",
        description: "Kirimkan tim alat berat dan ambulance ke lokasi sektor barat",
        dueAt: new Date(Date.now() + 86400000).toISOString(),
        resources: "1 Unit Excavator, 2 Unit Ambulance, 5 Personel SAR",
        createdAt: new Date().toISOString(),
        closedAt: null,
      },
      {
        id: "demo-task-2",
        reportId: "demo-report-2",
        incidentClusterId: "demo-cluster-2",
        status: "assigned",
        priority: "high",
        createdByProfileId: "demo-coordinator",
        category: "Distribusi Logistik & Tenda Pengungsian",
        description: "Pengiriman 50 paket sembako dan tenda darurat",
        dueAt: new Date(Date.now() + 172800000).toISOString(),
        resources: "50 Paket Sembako, 10 Tenda",
        createdAt: new Date().toISOString(),
        closedAt: null,
      },
    ];

    return buildPaginatedResult(demoItems, demoItems.length, pagination);
  }

  try {
    let query = db.from("response_tasks").select("*", { count: "exact" });
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.priority) query = query.eq("priority", filters.priority);
    if (filters.search) query = query.ilike("description", `%${filters.search}%`);

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
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    return {
      id: taskId,
      reportId: "demo-report-1",
      incidentClusterId: "demo-cluster-1",
      status: "in_progress",
      priority: "critical",
      createdByProfileId: "demo-coordinator",
      category: "Evakuasi Korban",
      description: "Tugas respons tim lapangan sektor barat",
      dueAt: new Date(Date.now() + 86400000).toISOString(),
      resources: "2 Unit Tim SAR",
      createdAt: new Date().toISOString(),
      closedAt: null,
    };
  }

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
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  const targetProfileId = input.assigneeProfileId ?? input.assignedProfileId ?? "";

  if (isDemoMode) {
    return {
      id: `demo-assignment-${Date.now()}`,
      taskId,
      assignedProfileId: targetProfileId,
      status: "assigned",
      assignedAt: new Date().toISOString(),
      notes: input.notes ?? null,
    };
  }

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
  priority: TaskPriority,
): Promise<ResponseTaskDto> {
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    const task = await getResponseTaskById(db, taskId);
    return { ...task, priority };
  }

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
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    const task = await getResponseTaskById(db, taskId);
    return { ...task, status };
  }

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
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    return [
      {
        id: `demo-assignment-${taskId}`,
        taskId,
        assignedProfileId: "demo-verifier",
        status: "assigned",
        assignedAt: new Date().toISOString(),
        notes: "Tim ditugaskan menuju lokasi",
      },
    ];
  }

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
