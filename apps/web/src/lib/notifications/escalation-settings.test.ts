import { describe, expect, it } from "vitest";
import { createFakeDb } from "../reports/service/test-support/fake-db";
import { listEscalationSettings, updateEscalationSetting } from "./escalation-settings";

const SETTING_ROW = {
  key: "escalation.task_overdue",
  value: { enabled: true, level: "warning" },
  updated_at: "2026-07-24T00:00:00.000Z",
};

describe("listEscalationSettings", () => {
  it("strips the escalation. key prefix and returns typed rule DTOs", async () => {
    const fakeDb = createFakeDb({ from: { system_settings: () => ({ data: [SETTING_ROW], error: null }) } });

    const result = await listEscalationSettings(fakeDb as never, "org-1");
    expect(result).toHaveLength(1);
    expect(result[0]?.ruleType).toBe("task_overdue");
    expect(result[0]?.value).toEqual({ enabled: true, level: "warning" });
  });

  it("filters out any system_settings row whose key isn't a recognized escalation rule type", async () => {
    const fakeDb = createFakeDb({
      from: {
        system_settings: () => ({
          data: [SETTING_ROW, { key: "escalation.made_up_rule", value: {}, updated_at: "2026-07-24T00:00:00.000Z" }],
          error: null,
        }),
      },
    });

    const result = await listEscalationSettings(fakeDb as never, "org-1");
    expect(result).toHaveLength(1);
    expect(result[0]?.ruleType).toBe("task_overdue");
  });

  it("throws ApiError('internal_error') on a query error", async () => {
    const fakeDb = createFakeDb({
      from: { system_settings: () => ({ data: null, error: { message: "connection reset" } }) },
    });

    await expect(listEscalationSettings(fakeDb as never, "org-1")).rejects.toMatchObject({ code: "internal_error" });
  });
});

describe("updateEscalationSetting", () => {
  it("validates against the rule's own schema and writes the parsed value", async () => {
    const fakeDb = createFakeDb({
      from: {
        system_settings: () => ({
          data: { key: "escalation.task_overdue", value: { enabled: false, level: "high" }, updated_at: "2026-07-24T01:00:00.000Z" },
          error: null,
        }),
      },
    });

    const result = await updateEscalationSetting(fakeDb as never, "org-1", "profile-1", "task_overdue", {
      enabled: false,
      level: "high",
    });
    expect(result.value).toEqual({ enabled: false, level: "high" });
  });

  it("throws ApiError('validation_failed') for a malformed value (bad level)", async () => {
    const fakeDb = createFakeDb({});

    await expect(
      updateEscalationSetting(fakeDb as never, "org-1", "profile-1", "task_overdue", { enabled: true, level: "urgent" }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("throws ApiError('validation_failed') for a missing required numeric field", async () => {
    const fakeDb = createFakeDb({});

    await expect(
      updateEscalationSetting(fakeDb as never, "org-1", "profile-1", "verified_destroyed_threshold", {
        enabled: true,
        level: "high",
      }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });

  it("throws ApiError('internal_error') when the update query errors", async () => {
    const fakeDb = createFakeDb({
      from: { system_settings: () => ({ data: null, error: { message: "connection reset" } }) },
    });

    await expect(
      updateEscalationSetting(fakeDb as never, "org-1", "profile-1", "task_overdue", { enabled: true, level: "warning" }),
    ).rejects.toMatchObject({ code: "internal_error" });
  });
});
