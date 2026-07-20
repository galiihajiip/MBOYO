import { describe, expect, it } from "vitest";
import { createFakeDb } from "./test-support/fake-db";
import { submitVerificationDecision, archiveReport } from "./transitions";
import { ApiError } from "../../api/errors";

const VERIFIED_REPORT_ROW = {
  id: "report-1",
  client_report_id: "client-1",
  reporter_profile_id: "profile-1",
  disaster_event_id: "event-1",
  status: "verified",
  description: "Rumah roboh sebagian",
  created_at_client: null,
  submitted_at: "2026-07-17T00:00:00.000Z",
  archived_at: null,
  created_at: "2026-07-17T00:00:00.000Z",
  updated_at: "2026-07-17T00:00:00.000Z",
};

const ARCHIVED_REPORT_ROW = { ...VERIFIED_REPORT_ROW, status: "archived", archived_at: "2026-07-17T01:00:00.000Z" };

describe("submitVerificationDecision", () => {
  it("returns the updated report DTO on a successful confirm decision", async () => {
    const fakeDb = createFakeDb({
      rpc: { submit_verification_decision: () => ({ data: VERIFIED_REPORT_ROW, error: null }) },
    });

    const result = await submitVerificationDecision(fakeDb as never, "report-1", { decision: "confirm" });
    expect(result.status).toBe("verified");
    expect(fakeDb.rpcCalls[0]?.fn).toBe("submit_verification_decision");
    expect(fakeDb.rpcCalls[0]?.args).toMatchObject({ p_report_id: "report-1", p_decision: "confirm" });
  });

  it("maps a 42501 (insufficient_privilege) Postgres error to ApiError('forbidden')", async () => {
    const fakeDb = createFakeDb({
      rpc: {
        submit_verification_decision: () => ({
          data: null,
          error: { code: "42501", message: "must hold verifier role" },
        }),
      },
    });

    await expect(
      submitVerificationDecision(fakeDb as never, "report-1", { decision: "confirm" }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("maps a P0002 (not found) Postgres error to ApiError('not_found')", async () => {
    const fakeDb = createFakeDb({
      rpc: {
        submit_verification_decision: () => ({ data: null, error: { code: "P0002", message: "not found" } }),
      },
    });

    await expect(
      submitVerificationDecision(fakeDb as never, "missing-report", { decision: "confirm" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("maps a P0001 (precondition failed) Postgres error to ApiError('invalid_transition') — e.g. deciding on a draft_local report", async () => {
    const fakeDb = createFakeDb({
      rpc: {
        submit_verification_decision: () => ({
          data: null,
          error: { code: "P0001", message: "report is in status draft_local" },
        }),
      },
    });

    await expect(
      submitVerificationDecision(fakeDb as never, "report-1", { decision: "confirm" }),
    ).rejects.toMatchObject({ code: "invalid_transition" });
  });

  it("maps an unrecognized Postgres error to ApiError('internal_error')", async () => {
    const fakeDb = createFakeDb({
      rpc: {
        submit_verification_decision: () => ({ data: null, error: { message: "connection reset" } }),
      },
    });

    await expect(
      submitVerificationDecision(fakeDb as never, "report-1", { decision: "confirm" }),
    ).rejects.toMatchObject({ code: "internal_error" });
    await expect(
      submitVerificationDecision(fakeDb as never, "report-1", { decision: "confirm" }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("passes overrideSeverity through to the RPC for an override decision", async () => {
    const fakeDb = createFakeDb({
      rpc: {
        submit_verification_decision: () => ({
          data: { ...VERIFIED_REPORT_ROW },
          error: null,
        }),
      },
    });

    await submitVerificationDecision(fakeDb as never, "report-1", {
      decision: "override",
      overrideSeverity: "destroyed",
    });

    expect(fakeDb.rpcCalls[0]?.args).toMatchObject({ p_decision: "override", p_override_severity: "destroyed" });
  });
});

describe("archiveReport", () => {
  it("returns the archived report DTO on success", async () => {
    const fakeDb = createFakeDb({
      rpc: { archive_report: () => ({ data: ARCHIVED_REPORT_ROW, error: null }) },
    });

    const result = await archiveReport(fakeDb as never, "report-1", { reason: "retention period elapsed" });
    expect(result.status).toBe("archived");
    expect(fakeDb.rpcCalls[0]?.fn).toBe("archive_report");
    expect(fakeDb.rpcCalls[0]?.args).toMatchObject({ p_report_id: "report-1", p_reason: "retention period elapsed" });
  });

  it("maps a P0001 error (e.g. archiving a needs_manual_review report) to ApiError('invalid_transition')", async () => {
    const fakeDb = createFakeDb({
      rpc: {
        archive_report: () => ({
          data: null,
          error: { code: "P0001", message: "only verified or rejected reports may be archived" },
        }),
      },
    });

    await expect(archiveReport(fakeDb as never, "report-1", {})).rejects.toMatchObject({
      code: "invalid_transition",
    });
  });

  it("maps a 42501 error (non-admin caller) to ApiError('forbidden')", async () => {
    const fakeDb = createFakeDb({
      rpc: {
        archive_report: () => ({ data: null, error: { code: "42501", message: "must hold system_administrator" } }),
      },
    });

    await expect(archiveReport(fakeDb as never, "report-1", {})).rejects.toMatchObject({ code: "forbidden" });
  });
});
