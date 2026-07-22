import { describe, expect, it } from "vitest";
import { createFakeDb } from "../reports/service/test-support/fake-db";
import {
  createDeletionRequest,
  listDeletionRequests,
  listLegalHolds,
  listRetentionPolicies,
  placeLegalHold,
  releaseLegalHold,
  reviewDeletionRequest,
  updateRetentionPolicy,
} from "./retention";

const SETTING_ROW = {
  key: "retention.evidence_retention_days",
  value: { days: 365, enabled: true },
  updated_at: "2026-07-26T00:00:00.000Z",
};

const DELETION_REQUEST_ROW = {
  id: "dr-1",
  requested_by_profile_id: "profile-1",
  subject_report_id: null,
  reason: "Permintaan pribadi",
  status: "pending" as const,
  reviewed_by_profile_id: null,
  review_notes: null,
  created_at: "2026-07-26T00:00:00.000Z",
  reviewed_at: null,
};

const LEGAL_HOLD_ROW = {
  id: "lh-1",
  report_id: "report-1",
  disaster_event_id: null,
  reason: "Investigasi",
  placed_by_profile_id: "profile-1",
  placed_at: "2026-07-26T00:00:00.000Z",
  released_at: null,
  released_by_profile_id: null,
};

describe("listRetentionPolicies", () => {
  it("strips the retention. key prefix and returns typed policy DTOs", async () => {
    const fakeDb = createFakeDb({ from: { system_settings: () => ({ data: [SETTING_ROW], error: null }) } });

    const result = await listRetentionPolicies(fakeDb as never, "org-1");
    expect(result[0]?.key).toBe("evidence_retention_days");
    expect(result[0]?.days).toBe(365);
  });
});

describe("updateRetentionPolicy", () => {
  it("validates and writes the parsed value", async () => {
    const fakeDb = createFakeDb({
      from: {
        system_settings: () => ({
          data: { key: "retention.evidence_retention_days", value: { days: 180, enabled: false }, updated_at: "2026-07-26T01:00:00.000Z" },
          error: null,
        }),
      },
    });

    const result = await updateRetentionPolicy(fakeDb as never, "org-1", "profile-1", "evidence_retention_days", {
      days: 180,
      enabled: false,
    });
    expect(result.days).toBe(180);
  });

  it("throws ApiError('validation_failed') for a non-positive days value", async () => {
    const fakeDb = createFakeDb({});

    await expect(
      updateRetentionPolicy(fakeDb as never, "org-1", "profile-1", "evidence_retention_days", { days: 0, enabled: true }),
    ).rejects.toMatchObject({ code: "validation_failed" });
  });
});

describe("createDeletionRequest", () => {
  it("returns the created deletion request DTO", async () => {
    const fakeDb = createFakeDb({ from: { deletion_requests: () => ({ data: DELETION_REQUEST_ROW, error: null }) } });

    const result = await createDeletionRequest(fakeDb as never, "profile-1", { reason: "Permintaan pribadi" });
    expect(result.status).toBe("pending");
  });
});

describe("listDeletionRequests", () => {
  it("returns deletion request DTOs", async () => {
    const fakeDb = createFakeDb({ from: { deletion_requests: () => ({ data: [DELETION_REQUEST_ROW], error: null }) } });

    const result = await listDeletionRequests(fakeDb as never);
    expect(result).toHaveLength(1);
  });
});

describe("reviewDeletionRequest", () => {
  it("returns the updated DTO on success", async () => {
    const fakeDb = createFakeDb({
      rpc: { review_deletion_request: () => ({ data: { ...DELETION_REQUEST_ROW, status: "approved" }, error: null }) },
    });

    const result = await reviewDeletionRequest(fakeDb as never, "dr-1", { status: "approved" });
    expect(result.status).toBe("approved");
  });
});

describe("listLegalHolds / placeLegalHold / releaseLegalHold", () => {
  it("lists legal holds", async () => {
    const fakeDb = createFakeDb({ from: { legal_holds: () => ({ data: [LEGAL_HOLD_ROW], error: null }) } });

    const result = await listLegalHolds(fakeDb as never);
    expect(result).toHaveLength(1);
  });

  it("places a legal hold", async () => {
    const fakeDb = createFakeDb({ rpc: { place_legal_hold: () => ({ data: LEGAL_HOLD_ROW, error: null }) } });

    const result = await placeLegalHold(fakeDb as never, { reportId: "report-1", reason: "Investigasi" });
    expect(result.reportId).toBe("report-1");
  });

  it("releases a legal hold", async () => {
    const fakeDb = createFakeDb({
      rpc: { release_legal_hold: () => ({ data: { ...LEGAL_HOLD_ROW, released_at: "2026-07-27T00:00:00.000Z" }, error: null }) },
    });

    const result = await releaseLegalHold(fakeDb as never, "lh-1");
    expect(result.releasedAt).toBe("2026-07-27T00:00:00.000Z");
  });
});
