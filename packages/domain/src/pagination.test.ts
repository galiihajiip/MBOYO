import { describe, expect, it } from "vitest";
import { paginationRequestSchema, buildPaginatedResult } from "./pagination";

describe("paginationRequestSchema", () => {
  it("defaults to page 1, pageSize 20 when nothing is given", () => {
    expect(paginationRequestSchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it("coerces string query-param values to numbers", () => {
    expect(paginationRequestSchema.parse({ page: "3", pageSize: "50" })).toEqual({ page: 3, pageSize: 50 });
  });

  it("rejects page below 1", () => {
    expect(() => paginationRequestSchema.parse({ page: 0 })).toThrow();
  });

  it("rejects pageSize above 100", () => {
    expect(() => paginationRequestSchema.parse({ pageSize: 101 })).toThrow();
  });
});

describe("buildPaginatedResult", () => {
  it("computes totalPages from totalCount and pageSize", () => {
    const result = buildPaginatedResult(["a", "b"], 45, { page: 1, pageSize: 20 });
    expect(result.totalPages).toBe(3);
  });

  it("always returns at least 1 totalPage even when totalCount is 0", () => {
    const result = buildPaginatedResult([], 0, { page: 1, pageSize: 20 });
    expect(result.totalPages).toBe(1);
  });
});
