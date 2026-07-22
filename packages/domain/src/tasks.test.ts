import { describe, expect, it } from "vitest";
import {
  addReportsToClusterSchema,
  assignResponseTaskSchema,
  createExportJobSchema,
  createIncidentClusterSchema,
  createResponseTaskSchema,
  setPrioritySchema,
  taskListFiltersSchema,
  transitionResponseTaskStatusSchema,
} from "./tasks";

describe("createIncidentClusterSchema", () => {
  it("accepts a valid cluster creation payload", () => {
    const result = createIncidentClusterSchema.safeParse({
      disasterEventId: "11111111-1111-1111-1111-111111111111",
      label: "Klaster Kecamatan Utara",
      reportIds: ["22222222-2222-2222-2222-222222222222"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty reportIds array", () => {
    const result = createIncidentClusterSchema.safeParse({
      disasterEventId: "11111111-1111-1111-1111-111111111111",
      label: "Klaster",
      reportIds: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty label", () => {
    const result = createIncidentClusterSchema.safeParse({
      disasterEventId: "11111111-1111-1111-1111-111111111111",
      label: "",
      reportIds: ["22222222-2222-2222-2222-222222222222"],
    });
    expect(result.success).toBe(false);
  });
});

describe("addReportsToClusterSchema", () => {
  it("accepts at least one reportId", () => {
    expect(addReportsToClusterSchema.safeParse({ reportIds: ["22222222-2222-2222-2222-222222222222"] }).success).toBe(
      true,
    );
  });

  it("rejects an empty reportIds array", () => {
    expect(addReportsToClusterSchema.safeParse({ reportIds: [] }).success).toBe(false);
  });
});

describe("createResponseTaskSchema", () => {
  const base = { category: "Evakuasi" };

  it("accepts a task targeting a reportId only", () => {
    const result = createResponseTaskSchema.safeParse({
      ...base,
      reportId: "11111111-1111-1111-1111-111111111111",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a task targeting an incidentClusterId only", () => {
    const result = createResponseTaskSchema.safeParse({
      ...base,
      incidentClusterId: "11111111-1111-1111-1111-111111111111",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a task targeting neither reportId nor incidentClusterId", () => {
    const result = createResponseTaskSchema.safeParse(base);
    expect(result.success).toBe(false);
  });

  it("rejects a task targeting both reportId and incidentClusterId", () => {
    const result = createResponseTaskSchema.safeParse({
      ...base,
      reportId: "11111111-1111-1111-1111-111111111111",
      incidentClusterId: "22222222-2222-2222-2222-222222222222",
    });
    expect(result.success).toBe(false);
  });

  it("rejects critical priority at creation time", () => {
    const result = createResponseTaskSchema.safeParse({
      ...base,
      reportId: "11111111-1111-1111-1111-111111111111",
      priority: "critical",
    });
    expect(result.success).toBe(false);
  });

  it("defaults priority to unassigned when omitted", () => {
    const result = createResponseTaskSchema.safeParse({
      ...base,
      reportId: "11111111-1111-1111-1111-111111111111",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe("unassigned");
    }
  });

  it("rejects an empty category", () => {
    const result = createResponseTaskSchema.safeParse({
      category: "",
      reportId: "11111111-1111-1111-1111-111111111111",
    });
    expect(result.success).toBe(false);
  });
});

describe("assignResponseTaskSchema", () => {
  it("accepts a valid assigneeProfileId", () => {
    expect(
      assignResponseTaskSchema.safeParse({ assigneeProfileId: "11111111-1111-1111-1111-111111111111" }).success,
    ).toBe(true);
  });

  it("rejects a non-uuid assigneeProfileId", () => {
    expect(assignResponseTaskSchema.safeParse({ assigneeProfileId: "not-a-uuid" }).success).toBe(false);
  });
});

describe("transitionResponseTaskStatusSchema", () => {
  it("accepts a non-cancel transition without a reason", () => {
    expect(transitionResponseTaskStatusSchema.safeParse({ newStatus: "acknowledged" }).success).toBe(true);
  });

  it("rejects a cancel transition without a reason", () => {
    expect(transitionResponseTaskStatusSchema.safeParse({ newStatus: "cancelled" }).success).toBe(false);
  });

  it("accepts a cancel transition with a reason", () => {
    expect(
      transitionResponseTaskStatusSchema.safeParse({ newStatus: "cancelled", reason: "Sumber daya tidak tersedia" })
        .success,
    ).toBe(true);
  });
});

describe("setPrioritySchema", () => {
  it("accepts a non-critical priority without a reason", () => {
    expect(setPrioritySchema.safeParse({ priority: "high" }).success).toBe(true);
  });

  it("rejects critical priority without a reason", () => {
    expect(setPrioritySchema.safeParse({ priority: "critical" }).success).toBe(false);
  });

  it("accepts critical priority with a reason", () => {
    expect(setPrioritySchema.safeParse({ priority: "critical", reason: "Korban jiwa dilaporkan" }).success).toBe(
      true,
    );
  });
});

describe("taskListFiltersSchema", () => {
  it("accepts an empty filter object", () => {
    expect(taskListFiltersSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a fully specified filter object", () => {
    const result = taskListFiltersSchema.safeParse({
      status: "in_progress",
      priority: "high",
      category: "Evakuasi",
      assigneeProfileId: "11111111-1111-1111-1111-111111111111",
      overdueOnly: true,
    });
    expect(result.success).toBe(true);
  });
});

describe("createExportJobSchema", () => {
  it("accepts a csv export request and defaults filterCriteria to {}", () => {
    const result = createExportJobSchema.safeParse({
      disasterEventId: "11111111-1111-1111-1111-111111111111",
      format: "csv",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.filterCriteria).toEqual({});
    }
  });

  it("rejects an unsupported format", () => {
    const result = createExportJobSchema.safeParse({
      disasterEventId: "11111111-1111-1111-1111-111111111111",
      format: "xlsx",
    });
    expect(result.success).toBe(false);
  });

  it("accepts the json format (BLOCK 26)", () => {
    const result = createExportJobSchema.safeParse({
      disasterEventId: "11111111-1111-1111-1111-111111111111",
      format: "json",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an optional fields allowlist for redaction", () => {
    const result = createExportJobSchema.safeParse({
      disasterEventId: "11111111-1111-1111-1111-111111111111",
      format: "csv",
      fields: ["reportId", "status"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fields).toEqual(["reportId", "status"]);
    }
  });
});
