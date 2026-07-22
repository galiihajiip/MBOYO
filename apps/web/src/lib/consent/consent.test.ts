import { describe, expect, it } from "vitest";
import { createFakeDb } from "../reports/service/test-support/fake-db";
import { getConsentStatus, recordConsent, CURRENT_CONSENT_VERSIONS } from "./consent";
import { ApiError } from "../api/errors";

describe("getConsentStatus", () => {
  it("reports needsConsent: true for a document the profile has never accepted", async () => {
    const db = createFakeDb({
      from: { consent_records: () => ({ data: [], error: null }) },
    });

    const statuses = await getConsentStatus(db as never, "profile-1");

    expect(statuses).toEqual([
      {
        documentKey: "privacy_notice",
        currentVersion: CURRENT_CONSENT_VERSIONS.privacy_notice,
        acceptedVersion: null,
        acceptedAt: null,
        needsConsent: true,
      },
    ]);
  });

  it("reports needsConsent: false when the latest accepted version matches the current version", async () => {
    const db = createFakeDb({
      from: {
        consent_records: () => ({
          data: [
            {
              document_key: "privacy_notice",
              version: CURRENT_CONSENT_VERSIONS.privacy_notice,
              accepted_at: "2026-07-27T00:00:00.000Z",
            },
          ],
          error: null,
        }),
      },
    });

    const statuses = await getConsentStatus(db as never, "profile-1");

    expect(statuses[0]?.needsConsent).toBe(false);
    expect(statuses[0]?.acceptedAt).toBe("2026-07-27T00:00:00.000Z");
  });

  it("reports needsConsent: true when the accepted version is older than the current version", async () => {
    const db = createFakeDb({
      from: {
        consent_records: () => ({
          data: [{ document_key: "privacy_notice", version: "2025-01-01", accepted_at: "2025-01-01T00:00:00.000Z" }],
          error: null,
        }),
      },
    });

    const statuses = await getConsentStatus(db as never, "profile-1");

    expect(statuses[0]?.needsConsent).toBe(true);
    expect(statuses[0]?.acceptedVersion).toBe("2025-01-01");
  });

  it("throws ApiError on a query error", async () => {
    const db = createFakeDb({
      from: { consent_records: () => ({ data: null, error: { message: "boom" } }) },
    });

    await expect(getConsentStatus(db as never, "profile-1")).rejects.toThrow(ApiError);
  });
});

describe("recordConsent", () => {
  it("calls record_consent with the document's current version", async () => {
    const db = createFakeDb({
      rpc: {
        record_consent: () => ({
          data: {
            document_key: "privacy_notice",
            version: CURRENT_CONSENT_VERSIONS.privacy_notice,
            accepted_at: "2026-07-27T00:00:00.000Z",
          },
          error: null,
        }),
      },
    });

    const result = await recordConsent(db as never, "privacy_notice");

    expect(result.version).toBe(CURRENT_CONSENT_VERSIONS.privacy_notice);
    expect(db.rpcCalls).toEqual([
      { fn: "record_consent", args: { p_document_key: "privacy_notice", p_version: CURRENT_CONSENT_VERSIONS.privacy_notice } },
    ]);
  });

  it("throws ApiError when the RPC fails", async () => {
    const db = createFakeDb({
      rpc: { record_consent: () => ({ data: null, error: { message: "boom" } }) },
    });

    await expect(recordConsent(db as never, "privacy_notice")).rejects.toThrow(ApiError);
  });
});
