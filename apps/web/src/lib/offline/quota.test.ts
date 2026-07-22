import { afterEach, describe, expect, it, vi } from "vitest";
import { getStorageEstimate, requestPersistentStorage, isQuotaExceededError } from "./quota";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getStorageEstimate", () => {
  it("reports supported:false when navigator.storage isn't available at all", async () => {
    vi.stubGlobal("navigator", {});

    const info = await getStorageEstimate();
    expect(info).toEqual({ usageBytes: null, quotaBytes: null, persisted: false, supported: false });
  });

  it("reports supported:false when navigator.storage.estimate itself is missing", async () => {
    vi.stubGlobal("navigator", { storage: {} });

    const info = await getStorageEstimate();
    expect(info.supported).toBe(false);
  });

  it("returns usage/quota from a successful estimate(), with persisted:false when persisted() is absent", async () => {
    vi.stubGlobal("navigator", {
      storage: {
        estimate: vi.fn().mockResolvedValue({ usage: 1024, quota: 1_000_000 }),
      },
    });

    const info = await getStorageEstimate();
    expect(info).toEqual({ usageBytes: 1024, quotaBytes: 1_000_000, persisted: false, supported: true });
  });

  it("reflects persisted:true when navigator.storage.persisted() resolves true", async () => {
    vi.stubGlobal("navigator", {
      storage: {
        estimate: vi.fn().mockResolvedValue({ usage: 500, quota: 2000 }),
        persisted: vi.fn().mockResolvedValue(true),
      },
    });

    const info = await getStorageEstimate();
    expect(info.persisted).toBe(true);
    expect(info.supported).toBe(true);
  });

  it("falls back to null usage/quota when estimate() omits those fields", async () => {
    vi.stubGlobal("navigator", {
      storage: {
        estimate: vi.fn().mockResolvedValue({}),
      },
    });

    const info = await getStorageEstimate();
    expect(info.usageBytes).toBeNull();
    expect(info.quotaBytes).toBeNull();
  });
});

describe("requestPersistentStorage", () => {
  it("returns false when navigator.storage isn't available", async () => {
    vi.stubGlobal("navigator", {});
    expect(await requestPersistentStorage()).toBe(false);
  });

  it("returns false when navigator.storage.persist itself is missing", async () => {
    vi.stubGlobal("navigator", { storage: {} });
    expect(await requestPersistentStorage()).toBe(false);
  });

  it("returns the resolved value of navigator.storage.persist() when granted", async () => {
    vi.stubGlobal("navigator", { storage: { persist: vi.fn().mockResolvedValue(true) } });
    expect(await requestPersistentStorage()).toBe(true);
  });

  it("returns the resolved value of navigator.storage.persist() when denied", async () => {
    vi.stubGlobal("navigator", { storage: { persist: vi.fn().mockResolvedValue(false) } });
    expect(await requestPersistentStorage()).toBe(false);
  });
});

describe("isQuotaExceededError", () => {
  it("returns true for a DOMException named QuotaExceededError", () => {
    expect(isQuotaExceededError(new DOMException("quota exceeded", "QuotaExceededError"))).toBe(true);
  });

  it("returns false for a DOMException with a different name", () => {
    expect(isQuotaExceededError(new DOMException("aborted", "AbortError"))).toBe(false);
  });

  it("returns false for a plain Error", () => {
    expect(isQuotaExceededError(new Error("some other failure"))).toBe(false);
  });

  it("returns false for a non-error thrown value", () => {
    expect(isQuotaExceededError("a plain string")).toBe(false);
    expect(isQuotaExceededError(null)).toBe(false);
    expect(isQuotaExceededError(undefined)).toBe(false);
  });
});
