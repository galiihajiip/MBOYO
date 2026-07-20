/**
 * Storage estimate + persistence request — surfaces real numbers to the
 * Reporter (per docs/product/RISK_REGISTER.md risk #2: browser storage
 * eviction under pressure) rather than assuming unlimited space, and
 * requests persistent storage so the browser is less likely to evict this
 * origin's data under global storage pressure.
 */

export interface StorageEstimateInfo {
  usageBytes: number | null;
  quotaBytes: number | null;
  /** True if the browser has granted persistent storage for this origin. */
  persisted: boolean;
  /** False if the StorageManager API itself isn't available (older browsers). */
  supported: boolean;
}

export async function getStorageEstimate(): Promise<StorageEstimateInfo> {
  if (typeof navigator === "undefined" || !("storage" in navigator) || !navigator.storage.estimate) {
    return { usageBytes: null, quotaBytes: null, persisted: false, supported: false };
  }

  const [estimate, persisted] = await Promise.all([
    navigator.storage.estimate(),
    navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(false),
  ]);

  return {
    usageBytes: estimate.usage ?? null,
    quotaBytes: estimate.quota ?? null,
    persisted,
    supported: true,
  };
}

/**
 * Requests persistent storage — best-effort; the browser may deny this
 * (e.g. without a user gesture, or in private browsing), and a denial is
 * not itself an error condition the caller needs to react to beyond
 * knowing persistence isn't guaranteed (see getStorageEstimate().persisted).
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("storage" in navigator) || !navigator.storage.persist) {
    return false;
  }
  return navigator.storage.persist();
}

export function isQuotaExceededError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "QuotaExceededError";
}
