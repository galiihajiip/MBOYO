import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { apiSuccess, apiFailure, type ApiResult } from "./result";
import { API_ERROR_STATUS } from "./error-codes";
import { ApiError } from "./errors";

/** Wraps a successful domain-service result in the ApiResult envelope with the correct 200 status. */
export function respondOk<T>(data: T, requestId: string, status = 200): NextResponse<ApiResult<T>> {
  return NextResponse.json(apiSuccess(data, requestId), { status });
}

/**
 * Translates any thrown error into an ApiResult failure + the correct HTTP
 * status — the single place this mapping happens, so every route in this
 * block fails the same way rather than each handler inventing its own
 * catch block. ApiError (lib/api/errors.ts) carries its own code/message;
 * ZodError becomes validation_failed with field-level detail; anything
 * else is internal_error with a generic message — the underlying exception
 * is never echoed back to the caller (it may contain DB/internal detail).
 */
export function respondError(error: unknown, requestId: string): NextResponse<ApiResult<never>> {
  if (error instanceof ApiError) {
    return NextResponse.json(apiFailure(error.code, error.message, requestId, error.fieldErrors), {
      status: API_ERROR_STATUS[error.code],
    });
  }

  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "_root";
      fieldErrors[key] ??= [];
      fieldErrors[key].push(issue.message);
    }
    return NextResponse.json(
      apiFailure("validation_failed", "Data permintaan tidak valid.", requestId, fieldErrors),
      { status: API_ERROR_STATUS.validation_failed },
    );
  }

  return NextResponse.json(apiFailure("internal_error", "Terjadi kesalahan pada server.", requestId), {
    status: API_ERROR_STATUS.internal_error,
  });
}
