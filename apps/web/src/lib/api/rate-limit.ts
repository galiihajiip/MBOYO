import "server-only";
import type { NextRequest } from "next/server";

interface Bucket {
  count: number;
  windowStartMs: number;
}

/**
 * In-process sliding-window-by-fixed-window rate limiter (BLOCK 28). Chosen
 * over a Redis/external store because this app has exactly one long-lived
 * Node process per deployment target (no serverless/multi-instance fan-out
 * documented anywhere in docs/adr/), so an in-memory Map is sufficient and
 * avoids adding a new infra dependency for a hackathon-scoped deployment —
 * see SECURITY_CHECKLIST.md for the explicit trade-off (resets on process
 * restart, does not coordinate across replicas if this app is ever scaled
 * horizontally).
 *
 * Fixed-window (not token bucket / leaky bucket): simplest correct
 * implementation of "at most N actions per window per key," which is all
 * this block's acceptance criteria require.
 */
const buckets = new Map<string, Bucket>();

// Bound the map's growth: a naive Map keyed by IP/profile would otherwise
// grow forever across a long-running process. Swept lazily (on next access
// past its window), not via a timer — no background interval to leak.
function sweepExpired(now: number, windowMs: number): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStartMs >= windowMs) {
      buckets.delete(key);
    }
  }
}

let opsSinceSweep = 0;

export interface RateLimitConfig {
  /** Unique namespace for this limiter's call site — e.g. "report:create", "login". */
  key: string;
  /** Max allowed hits per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the current window resets — for a Retry-After header. */
  retryAfterSeconds: number;
}

/**
 * Checks and consumes one hit for `config.key` scoped to `identity` (a
 * profile ID, IP address, or email — whatever the call site can uniquely
 * key on before/without authentication). Pure/synchronous: no I/O, so it's
 * cheap enough to call on every request including pre-auth ones (login).
 */
export function checkRateLimit(config: RateLimitConfig, identity: string): RateLimitResult {
  const now = Date.now();

  opsSinceSweep += 1;
  if (opsSinceSweep >= 200) {
    opsSinceSweep = 0;
    sweepExpired(now, config.windowMs);
  }

  const mapKey = `${config.key}:${identity}`;
  const existing = buckets.get(mapKey);

  if (!existing || now - existing.windowStartMs >= config.windowMs) {
    buckets.set(mapKey, { count: 1, windowStartMs: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= config.limit) {
    const retryAfterSeconds = Math.ceil((config.windowMs - (now - existing.windowStartMs)) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Test-only: clears all buckets so tests don't leak state across cases. */
export function resetRateLimitsForTesting(): void {
  buckets.clear();
  opsSinceSweep = 0;
}

/**
 * Best-effort client IP resolution for pre-auth rate limiting (e.g. login,
 * where there is no profileId yet to key on). Trusts x-forwarded-for's first
 * hop — acceptable here because this limiter is a defense-in-depth
 * abuse-slowdown, not the sole authorization control; a spoofed IP at worst
 * lets an attacker evade their own rate limit, it cannot grant access to
 * another account.
 */
export function resolveClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
