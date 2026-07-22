import { describe, expect, it } from "vitest";
import { createFakeDb } from "../reports/service/test-support/fake-db";
import { ApiError } from "../api/errors";
import {
  assignResponseTask,
  createResponseTask,
  getResponseTaskById,
  listResponseTasks,
  listTaskAssignments,
  setResponseTaskPriority,
  transitionResponseTaskStatus,
} from "./tasks";

const TASK_ROW = {
  id: "task-1",
  report_id: "report-1",
  incident_cluster_id: null,
  status: "draft" as const,
  priority: "unassigned" as const,
  created_by_profile_id: "profile-1",
  category: "Evakuasi",
  description: null,
  due_at: null,
  resources: null,
  created_at: "2026-07-23T00:00:00.000Z",
  closed_at: null,
};

describe("createResponseTask", () => {
  it("returns the created task DTO on success", async () => {
    const fakeDb = createFakeDb({ rpc: { create_response_task: () => ({ data: TASK_ROW, error: null }) } });

    const result = await createResponseTask(fakeDb as never, { reportId: "report-1", category: "Evakuasi", priority: "unassigned" });
    expect(result.id).toBe("task-1");
    expect(result.category).toBe("Evakuasi");
  });

  it("maps a 22023 error to ApiError('validation_failed')", async () => {
    const fakeDb = createFakeDb({
      rpc: { create_response_task: () => ({ data: null, error: { code: "22023", message: "category is required" } }) },
    });

    await expect(
      createResponseTask(fakeDb as never, { reportId: "report-1", category: "x", priority: "unassigned" }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });
});

describe("assignResponseTask", () => {
  it("returns the updated task DTO on success", async () => {
    const fakeDb = createFakeDb({
      rpc: { assign_response_task: () => ({ data: { ...TASK_ROW, status: "assigned" }, error: null }) },
    });

    const result = await assignResponseTask(fakeDb as never, "task-1", { assigneeProfileId: "profile-2" });
    expect(result.status).toBe("assigned");
  });

  it("maps a not-found error to ApiError('not_found')", async () => {
    const fakeDb = createFakeDb({
      rpc: { assign_response_task: () => ({ data: null, error: { code: "P0002", message: "not found" } }) },
    });

    await expect(assignResponseTask(fakeDb as never, "missing", { assigneeProfileId: "profile-2" })).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("transitionResponseTaskStatus", () => {
  it("returns the updated task DTO on success", async () => {
    const fakeDb = createFakeDb({
      rpc: {
        transition_response_task_status: () => ({ data: { ...TASK_ROW, status: "acknowledged" }, error: null }),
      },
    });

    const result = await transitionResponseTaskStatus(fakeDb as never, "task-1", { newStatus: "acknowledged" });
    expect(result.status).toBe("acknowledged");
  });

  it("maps a P0001 (invalid transition) error to ApiError('invalid_transition')", async () => {
    const fakeDb = createFakeDb({
      rpc: {
        transition_response_task_status: () => ({
          data: null,
          error: { code: "P0001", message: "draft -> completed is not a valid transition" },
        }),
      },
    });

    await expect(
      transitionResponseTaskStatus(fakeDb as never, "task-1", { newStatus: "completed" }),
    ).rejects.toMatchObject({ code: "invalid_transition" });
  });

  it("maps a 42501 error (non-assignee/non-coordinator) to ApiError('forbidden')", async () => {
    const fakeDb = createFakeDb({
      rpc: {
        transition_response_task_status: () => ({
          data: null,
          error: { code: "42501", message: "only the current assignee may advance task status" },
        }),
      },
    });

    await expect(
      transitionResponseTaskStatus(fakeDb as never, "task-1", { newStatus: "acknowledged" }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("setResponseTaskPriority", () => {
  it("returns the updated task DTO on success", async () => {
    const fakeDb = createFakeDb({
      rpc: { set_response_task_priority: () => ({ data: { ...TASK_ROW, priority: "critical" }, error: null }) },
    });

    const result = await setResponseTaskPriority(fakeDb as never, "task-1", { priority: "critical", reason: "Korban jiwa" });
    expect(result.priority).toBe("critical");
  });
});

describe("listResponseTasks", () => {
  it("returns a paginated result built from the query's rows and count", async () => {
    const fakeDb = createFakeDb({ from: { response_tasks: () => ({ data: [TASK_ROW], error: null, count: 1 }) } });

    const result = await listResponseTasks(fakeDb as never, {}, { page: 1, pageSize: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.totalCount).toBe(1);
  });

  it("throws ApiError('internal_error') on a query error", async () => {
    const fakeDb = createFakeDb({
      from: { response_tasks: () => ({ data: null, error: { message: "connection reset" } }) },
    });

    await expect(listResponseTasks(fakeDb as never, {}, { page: 1, pageSize: 20 })).rejects.toBeInstanceOf(ApiError);
  });

  it("scopes to an impossible id filter when assigneeProfileId matches no open assignments", async () => {
    let capturedBuilder: { calls: Array<{ method: string; args: unknown[] }> } | undefined;
    const fakeDb = createFakeDb({
      from: {
        task_assignments: () => ({ data: [], error: null }),
        response_tasks: () => ({ data: [], error: null, count: 0 }),
      },
    });
    const originalFrom = fakeDb.from.bind(fakeDb);
    fakeDb.from = (table: string) => {
      const builder = originalFrom(table);
      if (table === "response_tasks") capturedBuilder = builder;
      return builder;
    };

    await listResponseTasks(fakeDb as never, { assigneeProfileId: "profile-9" }, { page: 1, pageSize: 20 });

    const inCall = capturedBuilder?.calls.find((c) => c.method === "in");
    expect(inCall?.args).toEqual(["id", ["00000000-0000-0000-0000-000000000000"]]);
  });
});

describe("getResponseTaskById", () => {
  it("returns the task DTO when found", async () => {
    const fakeDb = createFakeDb({ from: { response_tasks: () => ({ data: TASK_ROW, error: null }) } });

    const result = await getResponseTaskById(fakeDb as never, "task-1");
    expect(result.id).toBe("task-1");
  });

  it("throws ApiError('not_found') when the task doesn't exist", async () => {
    const fakeDb = createFakeDb({ from: { response_tasks: () => ({ data: null, error: null }) } });

    await expect(getResponseTaskById(fakeDb as never, "missing")).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("listTaskAssignments", () => {
  it("returns assignment DTOs", async () => {
    const ASSIGNMENT_ROW = {
      id: "assignment-1",
      response_task_id: "task-1",
      assignee_profile_id: "profile-2",
      assigned_by_profile_id: "profile-1",
      assigned_at: "2026-07-23T00:00:00.000Z",
      unassigned_at: null,
    };
    const fakeDb = createFakeDb({ from: { task_assignments: () => ({ data: [ASSIGNMENT_ROW], error: null }) } });

    const result = await listTaskAssignments(fakeDb as never, "task-1");
    expect(result).toHaveLength(1);
    expect(result[0]?.assigneeProfileId).toBe("profile-2");
  });
});
