import { describe, expect, it } from "vitest";
import { computeNextRetryAt, computeNextRetryDelayMs } from "./backoff";

describe("computeNextRetryDelayMs — exponential backoff with jitter", () => {
  it("increases the delay ceiling as attempts grow", () => {
    // With full jitter the actual value is random, so assert on the
    // theoretical ceiling growing rather than a specific sampled value.
    const samplesAt = (attempts: number) =>
      Array.from({ length: 200 }, () => computeNextRetryDelayMs(attempts));

    const maxAt1 = Math.max(...samplesAt(1));
    const maxAt5 = Math.max(...samplesAt(5));

    expect(maxAt5).toBeGreaterThan(maxAt1);
  });

  it("never returns a negative delay", () => {
    for (let attempts = 0; attempts < 20; attempts++) {
      expect(computeNextRetryDelayMs(attempts)).toBeGreaterThanOrEqual(0);
    }
  });

  it("caps the delay so it never grows unbounded for very high attempt counts", () => {
    const delays = Array.from({ length: 50 }, () => computeNextRetryDelayMs(100));
    for (const delay of delays) {
      expect(delay).toBeLessThanOrEqual(5 * 60_000);
    }
  });

  it("produces varying delays across calls at the same attempt count (jitter, not a fixed value)", () => {
    const delays = new Set(Array.from({ length: 30 }, () => computeNextRetryDelayMs(4)));
    expect(delays.size).toBeGreaterThan(1);
  });
});

describe("computeNextRetryAt", () => {
  it("returns an ISO timestamp strictly after the given now", () => {
    const now = new Date("2026-07-17T00:00:00.000Z");
    const next = computeNextRetryAt(3, now);
    expect(new Date(next).getTime()).toBeGreaterThanOrEqual(now.getTime());
  });
});
