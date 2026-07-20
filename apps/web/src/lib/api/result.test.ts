import { describe, expect, it } from "vitest";
import { apiSuccess, apiFailure } from "./result";

describe("apiSuccess", () => {
  it("produces an ok:true envelope with the given data and requestId", () => {
    const result = apiSuccess({ id: "abc" }, "req-1");
    expect(result).toEqual({ ok: true, data: { id: "abc" }, requestId: "req-1" });
  });
});

describe("apiFailure", () => {
  it("produces an ok:false envelope without fieldErrors when none are given", () => {
    const result = apiFailure("not_found", "Laporan tidak ditemukan.", "req-2");
    expect(result).toEqual({
      ok: false,
      error: { code: "not_found", message: "Laporan tidak ditemukan." },
      requestId: "req-2",
    });
    expect(result.error.fieldErrors).toBeUndefined();
  });

  it("includes fieldErrors when given (validation_failed shape)", () => {
    const result = apiFailure("validation_failed", "Data tidak valid.", "req-3", {
      overrideSeverity: ["overrideSeverity wajib diisi ketika keputusan adalah override."],
    });
    expect(result.error.fieldErrors).toEqual({
      overrideSeverity: ["overrideSeverity wajib diisi ketika keputusan adalah override."],
    });
  });
});
