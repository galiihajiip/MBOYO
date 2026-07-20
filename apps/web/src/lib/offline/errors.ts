/**
 * Permanent vs retryable error classification for sync failures. A
 * retryable error (network unreachable, server 5xx, timeout) schedules a
 * backoff retry; a permanent error (validation rejection, 4xx other than
 * 401/408/429, quota exceeded on the *server* side) marks the item
 * `failed` without further automatic retries — the Reporter can still
 * retry manually (retryItem), but the queue does not burn battery/data
 * retrying something that will never succeed unchanged.
 */

export type ErrorKind = "retryable" | "permanent";

export interface ClassifiedError {
  kind: ErrorKind;
  message: string;
}

/**
 * Thrown by sync logic to explicitly mark an error's classification,
 * rather than leaving classification to be guessed from a generic Error
 * downstream.
 */
export class SyncError extends Error {
  readonly kind: ErrorKind;

  constructor(message: string, kind: ErrorKind) {
    super(message);
    this.name = "SyncError";
    this.kind = kind;
  }
}

/**
 * Best-effort classification for an error that wasn't already a SyncError
 * (e.g. a raw fetch/network exception) — defaults to retryable, since
 * treating an unknown failure as permanent risks silently abandoning a
 * report that would have succeeded on retry, which is a worse outcome
 * than one extra retry attempt.
 */
export function classifyError(error: unknown): ClassifiedError {
  if (error instanceof SyncError) {
    return { kind: error.kind, message: error.message };
  }

  if (error instanceof DOMException) {
    // QuotaExceededError from IndexedDB writes is retryable at the
    // application level (see ./quota.ts — the caller should prune and
    // retry), not a permanent failure of this specific report.
    if (error.name === "QuotaExceededError") {
      return { kind: "retryable", message: "Penyimpanan perangkat penuh — coba lagi setelah membersihkan data lama." };
    }
  }

  if (error instanceof Error) {
    return { kind: "retryable", message: error.message };
  }

  return { kind: "retryable", message: "Terjadi kesalahan yang tidak diketahui." };
}
