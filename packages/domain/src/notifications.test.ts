import { describe, expect, it } from "vitest";
import {
  createPushSubscriptionSchema,
  deletePushSubscriptionSchema,
  escalationSettingSchemas,
  notificationListFiltersSchema,
  updateEscalationSettingSchema,
} from "./notifications";

describe("escalationSettingSchemas", () => {
  it("accepts a valid verified_destroyed_threshold value", () => {
    const result = escalationSettingSchemas.verified_destroyed_threshold.safeParse({
      enabled: true,
      minProbability: 0.7,
      level: "high",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a minProbability outside 0..1", () => {
    const result = escalationSettingSchemas.verified_destroyed_threshold.safeParse({
      enabled: true,
      minProbability: 1.5,
      level: "high",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid cluster_destroyed_radius value", () => {
    const result = escalationSettingSchemas.cluster_destroyed_radius.safeParse({
      enabled: true,
      minCount: 3,
      radiusMeters: 500,
      windowHours: 24,
      level: "critical",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid level", () => {
    const result = escalationSettingSchemas.task_overdue.safeParse({ enabled: true, level: "urgent" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid repeated_analysis_failure value", () => {
    const result = escalationSettingSchemas.repeated_analysis_failure.safeParse({
      enabled: true,
      minFailures: 3,
      windowHours: 6,
      level: "high",
    });
    expect(result.success).toBe(true);
  });
});

describe("updateEscalationSettingSchema", () => {
  it("accepts a ruleType + record value", () => {
    const result = updateEscalationSettingSchema.safeParse({
      ruleType: "task_overdue",
      value: { enabled: false, level: "warning" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unrecognized ruleType", () => {
    const result = updateEscalationSettingSchema.safeParse({ ruleType: "made_up_rule", value: {} });
    expect(result.success).toBe(false);
  });
});

describe("notificationListFiltersSchema", () => {
  it("accepts an empty filter object", () => {
    expect(notificationListFiltersSchema.safeParse({}).success).toBe(true);
  });

  it("accepts unreadOnly: true", () => {
    expect(notificationListFiltersSchema.safeParse({ unreadOnly: true }).success).toBe(true);
  });
});

describe("createPushSubscriptionSchema", () => {
  it("accepts a valid Web Push subscription object", () => {
    const result = createPushSubscriptionSchema.safeParse({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
      keys: { p256dh: "key1", auth: "key2" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-URL endpoint", () => {
    const result = createPushSubscriptionSchema.safeParse({
      endpoint: "not-a-url",
      keys: { p256dh: "key1", auth: "key2" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing keys object", () => {
    const result = createPushSubscriptionSchema.safeParse({ endpoint: "https://example.com/push" });
    expect(result.success).toBe(false);
  });
});

describe("deletePushSubscriptionSchema", () => {
  it("accepts a valid endpoint", () => {
    expect(deletePushSubscriptionSchema.safeParse({ endpoint: "https://example.com/push" }).success).toBe(true);
  });
});
