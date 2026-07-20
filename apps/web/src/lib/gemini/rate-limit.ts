/**
 * A minimal in-process sliding-window rate limiter for outbound Gemini
 * calls — mirrors apps/ml-api/app/rate_limit.py's shape (same fixed-window
 * counter approach), since apps/web has no prior TypeScript-side rate
 * limiter to reuse and this keeps the two languages' simplest-possible
 * implementation consistent. Deliberately in-process (no Redis/Upstash
 * dependency) since Gemini calls are Verifier-triggered, low-volume,
 * human-paced actions, not a high-throughput path needing a distributed
 * limiter.
 */
export class SlidingWindowRateLimiter {
  private readonly windowMs = 60_000;
  private readonly history = new Map<string, number[]>();

  constructor(private readonly requestsPerWindow: number) {}

  allow(key: string): boolean {
    const now = Date.now();
    const existing = this.history.get(key) ?? [];
    const withinWindow = existing.filter((timestamp) => timestamp > now - this.windowMs);

    if (withinWindow.length >= this.requestsPerWindow) {
      this.history.set(key, withinWindow);
      return false;
    }

    withinWindow.push(now);
    this.history.set(key, withinWindow);
    return true;
  }
}
