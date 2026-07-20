/**
 * Single-flight lock so at most one sync pass runs at a time — without
 * this, a Background Sync event firing while the page's own reconnect
 * handler is also syncing (or two tabs open at once) could double-claim
 * or interleave writes to the same queue items. Uses the Web Locks API
 * (navigator.locks) where available, since it is the one mechanism that
 * coordinates across tabs/service-worker contexts, not just within a
 * single JS realm; falls back to an in-memory flag (single-tab-only
 * safety) where Web Locks isn't supported.
 */

const LOCK_NAME = "mboyo-offline-sync";

let inMemoryLockHeld = false;

export async function withSyncLock<T>(fn: () => Promise<T>): Promise<T | null> {
  if (typeof navigator !== "undefined" && "locks" in navigator) {
    let ran = false;
    let result: T | null = null;
    await navigator.locks.request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
      if (!lock) return; // another tab/context already holds the lock — skip this pass, not an error.
      ran = true;
      result = await fn();
    });
    return ran ? result : null;
  }

  // Fallback: in-memory flag, only coordinates within this single JS realm.
  if (inMemoryLockHeld) return null;
  inMemoryLockHeld = true;
  try {
    return await fn();
  } finally {
    inMemoryLockHeld = false;
  }
}
