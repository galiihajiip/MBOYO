import type { NextRequest } from "next/server";

/**
 * Resolves this request's ID: reuses an inbound `x-request-id` header if a
 * caller/proxy already set one (so a request traced upstream keeps the same
 * ID through this hop), otherwise mints a fresh UUID. Every route in this
 * block calls this once at the top of its handler and threads the result
 * through every ApiResult it returns, satisfying "request IDs" as an actual
 * correlation mechanism rather than a decorative field.
 */
export function resolveRequestId(request: NextRequest): string {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}
