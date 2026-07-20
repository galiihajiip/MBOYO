import { describe, expect, it, vi } from "vitest";
import { SlidingWindowRateLimiter } from "./rate-limit";

describe("SlidingWindowRateLimiter", () => {
  it("allows requests up to the configured limit within a window", () => {
    const limiter = new SlidingWindowRateLimiter(3);
    expect(limiter.allow("verifier-1")).toBe(true);
    expect(limiter.allow("verifier-1")).toBe(true);
    expect(limiter.allow("verifier-1")).toBe(true);
    expect(limiter.allow("verifier-1")).toBe(false);
  });

  it("tracks separate keys independently", () => {
    const limiter = new SlidingWindowRateLimiter(1);
    expect(limiter.allow("verifier-1")).toBe(true);
    expect(limiter.allow("verifier-2")).toBe(true);
    expect(limiter.allow("verifier-1")).toBe(false);
    expect(limiter.allow("verifier-2")).toBe(false);
  });

  it("allows requests again once the window has passed", () => {
    vi.useFakeTimers();
    try {
      const limiter = new SlidingWindowRateLimiter(1);
      expect(limiter.allow("verifier-1")).toBe(true);
      expect(limiter.allow("verifier-1")).toBe(false);

      vi.advanceTimersByTime(61_000);
      expect(limiter.allow("verifier-1")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
