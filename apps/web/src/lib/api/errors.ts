import "server-only";
import type { ApiErrorCode } from "./error-codes";

/**
 * Thrown by domain-service functions (lib/reports/service.ts) to signal a
 * specific, stable failure — the route handler's job is only to catch this
 * and translate it into an ApiResult via lib/api/respond.ts, never to
 * re-derive the error code from a generic exception. Mirrors the
 * EvidenceError pattern from BLOCK 15 (apps/web/src/lib/evidence/errors.ts)
 * — same shape, applied to the report-service domain instead of the
 * evidence-upload pipeline.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(code: ApiErrorCode, message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}
