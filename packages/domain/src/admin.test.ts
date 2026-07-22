import { describe, expect, it } from "vitest";
import {
  createDeletionRequestSchema,
  createDisasterEventSchema,
  grantRoleSchema,
  placeLegalHoldSchema,
  retentionPolicySchema,
  revokeRoleSchema,
  reviewDeletionRequestSchema,
  updateDisasterEventSchema,
} from "./admin";

describe("grantRoleSchema", () => {
  it("accepts a valid profileId/role pair", () => {
    expect(grantRoleSchema.safeParse({ profileId: "11111111-1111-1111-1111-111111111111", role: "verifier" }).success).toBe(true);
  });

  it("rejects an unrecognized role", () => {
    expect(grantRoleSchema.safeParse({ profileId: "11111111-1111-1111-1111-111111111111", role: "superadmin" }).success).toBe(false);
  });
});

describe("revokeRoleSchema", () => {
  it("accepts a valid profileId/role pair", () => {
    expect(revokeRoleSchema.safeParse({ profileId: "11111111-1111-1111-1111-111111111111", role: "auditor" }).success).toBe(true);
  });
});

describe("createDisasterEventSchema", () => {
  it("accepts a name-only payload", () => {
    expect(createDisasterEventSchema.safeParse({ name: "Gempa Cianjur" }).success).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(createDisasterEventSchema.safeParse({ name: "" }).success).toBe(false);
  });
});

describe("updateDisasterEventSchema", () => {
  it("accepts an empty (no-op) update", () => {
    expect(updateDisasterEventSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a status-only update", () => {
    expect(updateDisasterEventSchema.safeParse({ status: "closed" }).success).toBe(true);
  });

  it("rejects an invalid status", () => {
    expect(updateDisasterEventSchema.safeParse({ status: "archived" }).success).toBe(false);
  });
});

describe("createDeletionRequestSchema", () => {
  it("accepts a reason-only request", () => {
    expect(createDeletionRequestSchema.safeParse({ reason: "Permintaan penghapusan data pribadi." }).success).toBe(true);
  });

  it("rejects an empty reason", () => {
    expect(createDeletionRequestSchema.safeParse({ reason: "" }).success).toBe(false);
  });
});

describe("reviewDeletionRequestSchema", () => {
  it("accepts approved/denied/completed", () => {
    for (const status of ["approved", "denied", "completed"] as const) {
      expect(reviewDeletionRequestSchema.safeParse({ status }).success).toBe(true);
    }
  });

  it("rejects pending (cannot revert)", () => {
    expect(reviewDeletionRequestSchema.safeParse({ status: "pending" }).success).toBe(false);
  });
});

describe("placeLegalHoldSchema", () => {
  it("accepts exactly one of reportId or disasterEventId", () => {
    expect(
      placeLegalHoldSchema.safeParse({ reportId: "11111111-1111-1111-1111-111111111111", reason: "Investigasi hukum" }).success,
    ).toBe(true);
  });

  it("rejects both reportId and disasterEventId", () => {
    expect(
      placeLegalHoldSchema.safeParse({
        reportId: "11111111-1111-1111-1111-111111111111",
        disasterEventId: "22222222-2222-2222-2222-222222222222",
        reason: "x",
      }).success,
    ).toBe(false);
  });

  it("rejects neither reportId nor disasterEventId", () => {
    expect(placeLegalHoldSchema.safeParse({ reason: "x" }).success).toBe(false);
  });
});

describe("retentionPolicySchema", () => {
  it("accepts a valid policy value", () => {
    expect(retentionPolicySchema.safeParse({ enabled: true, days: 365 }).success).toBe(true);
  });

  it("rejects a non-positive days value", () => {
    expect(retentionPolicySchema.safeParse({ enabled: true, days: 0 }).success).toBe(false);
  });
});
