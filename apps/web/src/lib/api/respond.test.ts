import { describe, expect, it } from "vitest";
import { z } from "zod";
import { respondOk, respondError } from "./respond";
import { ApiError } from "./errors";
import { API_ERROR_STATUS } from "./error-codes";
import type { ApiResult } from "./result";

describe("respondOk", () => {
  it("returns a 200 by default with the ApiResult success envelope", async () => {
    const response = respondOk({ id: "abc" }, "req-1");
    expect(response.status).toBe(200);
    const body = (await response.json()) as ApiResult<{ id: string }>;
    expect(body).toEqual({ ok: true, data: { id: "abc" }, requestId: "req-1" });
  });

  it("honors an explicit status override", () => {
    const response = respondOk({ id: "abc" }, "req-1", 201);
    expect(response.status).toBe(201);
  });
});

describe("respondError", () => {
  it("translates an ApiError into its declared code and canonical status", async () => {
    const error = new ApiError("forbidden", "Anda tidak memiliki izin.");
    const response = respondError(error, "req-2");

    expect(response.status).toBe(API_ERROR_STATUS.forbidden);
    const body = (await response.json()) as ApiResult<never>;
    expect(body).toEqual({
      ok: false,
      error: { code: "forbidden", message: "Anda tidak memiliki izin." },
      requestId: "req-2",
    });
  });

  it("includes fieldErrors from an ApiError that carries them", async () => {
    const error = new ApiError("validation_failed", "Data tidak valid.", { field: ["required"] });
    const response = respondError(error, "req-3");
    const body = (await response.json()) as ApiResult<never>;
    expect(!body.ok && body.error.fieldErrors).toEqual({ field: ["required"] });
  });

  it("translates a ZodError into validation_failed with per-field fieldErrors", async () => {
    const schema = z.object({ email: z.string().email() });
    const result = schema.safeParse({ email: "not-an-email" });
    if (result.success) throw new Error("expected parse failure");

    const response = respondError(result.error, "req-4");
    expect(response.status).toBe(API_ERROR_STATUS.validation_failed);
    const body = (await response.json()) as ApiResult<never>;
    expect(body.ok).toBe(false);
    if (body.ok) throw new Error("expected failure envelope");
    expect(body.error.code).toBe("validation_failed");
    expect(body.error.fieldErrors?.email).toBeDefined();
  });

  it("translates an unknown thrown value into internal_error without leaking its message", async () => {
    const response = respondError(new Error("some internal DB connection string leaked here"), "req-5");
    expect(response.status).toBe(API_ERROR_STATUS.internal_error);
    const body = (await response.json()) as ApiResult<never>;
    if (body.ok) throw new Error("expected failure envelope");
    expect(body.error.code).toBe("internal_error");
    expect(body.error.message).not.toContain("DB connection string");
  });
});
