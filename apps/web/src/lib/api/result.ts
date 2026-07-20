import type { ApiErrorCode } from "./error-codes";

/**
 * ApiResult<T> is the single response envelope every BFF/domain-service
 * route in this block (and any future one) returns — success and failure
 * are structurally distinguishable by `ok`, so a caller (offline
 * sync-replay, a future typed client, a test) can branch on `result.ok`
 * without string-matching an HTTP status or a message. `requestId` is
 * threaded through from lib/api/request-id.ts so a failure can be
 * correlated to server logs without exposing internals in the message
 * itself — this is the "request IDs" requirement's concrete shape.
 */

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  requestId: string;
}

export interface ApiFailure {
  ok: false;
  error: {
    /** Stable, machine-readable — see ./error-codes.ts. Never a raw exception message. */
    code: ApiErrorCode;
    /** Bahasa Indonesia, safe to show a user. */
    message: string;
    /** Present only for validation failures (Zod issues), field-level detail for form UIs. */
    fieldErrors?: Record<string, string[]>;
  };
  requestId: string;
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export function apiSuccess<T>(data: T, requestId: string): ApiSuccess<T> {
  return { ok: true, data, requestId };
}

export function apiFailure(
  code: ApiErrorCode,
  message: string,
  requestId: string,
  fieldErrors?: Record<string, string[]>,
): ApiFailure {
  return { ok: false, error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) }, requestId };
}

// Re-exported here so route handlers importing ApiResult also have the
// error-code type in scope without a second import in the common case.
export type { ApiErrorCode };
