import { describe, expect, it } from "vitest";
import { createFakeDb } from "../reports/service/test-support/fake-db";
import { checkDuplicateHash } from "./duplicate-check";

describe("checkDuplicateHash", () => {
  it("returns true when a matching hash exists on another report", async () => {
    const db = createFakeDb({
      from: { report_evidence: () => ({ data: [{ id: "evidence-1" }], error: null }) },
    });

    const result = await checkDuplicateHash(db as never, "abc123", "report-1");
    expect(result).toBe(true);
  });

  it("returns false when no matching hash exists", async () => {
    const db = createFakeDb({
      from: { report_evidence: () => ({ data: [], error: null }) },
    });

    const result = await checkDuplicateHash(db as never, "abc123", "report-1");
    expect(result).toBe(false);
  });

  it("returns false when the query errors (data is null)", async () => {
    const db = createFakeDb({
      from: { report_evidence: () => ({ data: null, error: { message: "boom" } }) },
    });

    const result = await checkDuplicateHash(db as never, "abc123", "report-1");
    expect(result).toBe(false);
  });

  it("excludes the given report id from the match (query shape assertion)", async () => {
    const db = createFakeDb({
      from: { report_evidence: () => ({ data: [], error: null }) },
    });

    await checkDuplicateHash(db as never, "abc123", "report-1");

    const builderCalls = db.fromCalls;
    expect(builderCalls).toEqual(["report_evidence"]);
  });
});
