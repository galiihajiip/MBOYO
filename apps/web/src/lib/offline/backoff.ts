/**
 * Exponential backoff with full jitter (AWS-style: a random delay in
 * [0, cap*2^attempt], not just cap*2^attempt itself) — full jitter avoids
 * every queued item retrying in lockstep after a shared outage, which
 * would otherwise recreate the same thundering-herd load spike on
 * reconnect that the backoff is meant to prevent.
 */

const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 5 * 60_000; // cap at 5 minutes
const MAX_ATTEMPTS_BEFORE_PERMANENT_BACKOFF_CAP = 8;

export function computeNextRetryDelayMs(attempts: number): number {
  const cappedAttempts = Math.min(attempts, MAX_ATTEMPTS_BEFORE_PERMANENT_BACKOFF_CAP);
  const exponential = BASE_DELAY_MS * 2 ** cappedAttempts;
  const cappedExponential = Math.min(exponential, MAX_DELAY_MS);
  return Math.floor(Math.random() * cappedExponential);
}

export function computeNextRetryAt(attempts: number, now: Date = new Date()): string {
  const delayMs = computeNextRetryDelayMs(attempts);
  return new Date(now.getTime() + delayMs).toISOString();
}
