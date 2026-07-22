import { describe, expect, it, beforeEach, vi } from "vitest";
import { checkRateLimit, resetRateLimitsForTesting, resolveClientIp } from "./rate-limit";
import { NextRequest } from "next/server";

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimitsForTesting();
    vi.useRealTimers();
  });

  it("allows up to the configured limit within the window", () => {
    const config = { key: "test:allow", limit: 3, windowMs: 60_000 };
    expect(checkRateLimit(config, "user-1").allowed).toBe(true);
    expect(checkRateLimit(config, "user-1").allowed).toBe(true);
    expect(checkRateLimit(config, "user-1").allowed).toBe(true);
  });

  it("denies the (limit + 1)th hit within the same window", () => {
    const config = { key: "test:deny", limit: 2, windowMs: 60_000 };
    expect(checkRateLimit(config, "user-1").allowed).toBe(true);
    expect(checkRateLimit(config, "user-1").allowed).toBe(true);
    const third = checkRateLimit(config, "user-1");
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks separate identities independently", () => {
    const config = { key: "test:isolate", limit: 1, windowMs: 60_000 };
    expect(checkRateLimit(config, "user-1").allowed).toBe(true);
    expect(checkRateLimit(config, "user-2").allowed).toBe(true);
    expect(checkRateLimit(config, "user-1").allowed).toBe(false);
  });

  it("tracks separate keys (call sites) independently for the same identity", () => {
    expect(checkRateLimit({ key: "a", limit: 1, windowMs: 60_000 }, "user-1").allowed).toBe(true);
    expect(checkRateLimit({ key: "b", limit: 1, windowMs: 60_000 }, "user-1").allowed).toBe(true);
  });

  it("resets after the window elapses", () => {
    vi.useFakeTimers();
    const start = new Date("2026-01-01T00:00:00.000Z");
    vi.setSystemTime(start);

    const config = { key: "test:reset", limit: 1, windowMs: 1_000 };
    expect(checkRateLimit(config, "user-1").allowed).toBe(true);
    expect(checkRateLimit(config, "user-1").allowed).toBe(false);

    vi.setSystemTime(new Date(start.getTime() + 1_001));
    expect(checkRateLimit(config, "user-1").allowed).toBe(true);

    vi.useRealTimers();
  });
});

describe("resolveClientIp", () => {
  it("returns the first hop of x-forwarded-for", () => {
    const request = new NextRequest("http://localhost/api/reports", {
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
    });
    expect(resolveClientIp(request)).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const request = new NextRequest("http://localhost/api/reports", {
      headers: { "x-real-ip": "198.51.100.9" },
    });
    expect(resolveClientIp(request)).toBe("198.51.100.9");
  });

  it("returns 'unknown' when neither header is present", () => {
    const request = new NextRequest("http://localhost/api/reports");
    expect(resolveClientIp(request)).toBe("unknown");
  });
});
