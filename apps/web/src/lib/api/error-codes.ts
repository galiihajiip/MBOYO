/**
 * Stable, machine-readable error codes for every report-service route in
 * this block. "Stable" means: once shipped, a code's meaning never changes
 * and a code is never removed while any client (offline sync-replay, a
 * future typed client, tests) may still depend on it — only added to.
 * Never expose a raw exception message or a Postgres error string as the
 * user-facing `message`; that value is looked up from ERROR_STATUS below
 * or set explicitly per call site, and the code is what callers branch on.
 */
export const API_ERROR_CODES = [
  "unauthenticated",
  "forbidden",
  "validation_failed",
  "not_found",
  "conflict",
  "invalid_transition",
  "precondition_failed",
  "rate_limited",
  "internal_error",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Every code's canonical HTTP status — one place, so a route handler never guesses. */
export const API_ERROR_STATUS: Record<ApiErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  validation_failed: 400,
  not_found: 404,
  conflict: 409,
  invalid_transition: 409,
  precondition_failed: 412,
  rate_limited: 429,
  internal_error: 500,
};
