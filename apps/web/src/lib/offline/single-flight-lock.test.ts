import { afterEach, describe, expect, it, vi } from "vitest";
import { withSyncLock } from "./single-flight-lock";

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * A minimal fake of the Web Locks API's navigator.locks.request — mirrors
 * a real single-held-lock browser: while `held` is true, any request made
 * with `{ ifAvailable: true }` is granted a null lock (the documented
 * "not available right now" signal), exactly like the real API.
 */
function makeFakeLocks() {
  let held = false;
  const request = vi.fn(
    async (_name: string, _opts: { ifAvailable?: boolean }, callback: (lock: unknown) => Promise<unknown>) => {
      if (held) {
        return callback(null);
      }
      held = true;
      try {
        return await callback({ name: _name, mode: "exclusive" });
      } finally {
        held = false;
      }
    },
  );
  return { request };
}

describe("withSyncLock — Web Locks API path (navigator.locks available)", () => {
  it("runs fn and returns its result when the lock is free", async () => {
    vi.stubGlobal("navigator", { locks: makeFakeLocks() });

    const result = await withSyncLock(() => Promise.resolve("sync-result"));
    expect(result).toBe("sync-result");
  });

  it("calls navigator.locks.request with ifAvailable:true and the expected lock name", async () => {
    const locks = makeFakeLocks();
    vi.stubGlobal("navigator", { locks });

    await withSyncLock(() => Promise.resolve("ok"));

    expect(locks.request).toHaveBeenCalledWith(
      "mboyo-offline-sync",
      { ifAvailable: true },
      expect.any(Function),
    );
  });

  it("returns null (does not run fn) when the lock is already held by another caller", async () => {
    // A fake where the *second* call sees the lock held because the first
    // call's fn hasn't resolved yet — mirrors the real Web Locks API's
    // ifAvailable:true semantics (null lock granted immediately instead of
    // queuing).
    let locked = false;
    const request = vi.fn(
      async (_name: string, _opts: { ifAvailable?: boolean }, callback: (lock: unknown) => Promise<unknown>) => {
        if (locked) return callback(null);
        locked = true;
        try {
          return await callback({ name: _name });
        } finally {
          locked = false;
        }
      },
    );
    vi.stubGlobal("navigator", { locks: { request } });

    let resolveFirst!: () => void;
    const firstFnGate = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });

    const firstCall = withSyncLock(async () => {
      await firstFnGate;
      return "first";
    });

    // Give the first call a tick to acquire the lock before the second
    // call is attempted.
    await Promise.resolve();
    await Promise.resolve();

    const secondCall = withSyncLock(() => Promise.resolve("second"));
    const secondResult = await secondCall;
    expect(secondResult).toBeNull();

    resolveFirst();
    expect(await firstCall).toBe("first");
  });

  it("releases the lock after fn resolves, allowing a subsequent call to acquire it", async () => {
    vi.stubGlobal("navigator", { locks: makeFakeLocks() });

    const first = await withSyncLock(() => Promise.resolve("first"));
    const second = await withSyncLock(() => Promise.resolve("second"));

    expect(first).toBe("first");
    expect(second).toBe("second");
  });

  it("propagates a thrown error from fn and still releases the lock for the next call", async () => {
    vi.stubGlobal("navigator", { locks: makeFakeLocks() });

    await expect(
      withSyncLock(() => {
        throw new Error("sync failed");
      }),
    ).rejects.toThrow("sync failed");

    // Lock must be released even though fn threw — a subsequent call
    // should still be able to acquire it and run.
    const result = await withSyncLock(() => Promise.resolve("recovered"));
    expect(result).toBe("recovered");
  });
});

describe("withSyncLock — in-memory fallback path (navigator.locks unavailable)", () => {
  it("runs fn and returns its result when no other call is in flight", async () => {
    vi.stubGlobal("navigator", {});

    const result = await withSyncLock(() => Promise.resolve("fallback-result"));
    expect(result).toBe("fallback-result");
  });

  it("returns null for a concurrent second call while the first is still running", async () => {
    vi.stubGlobal("navigator", {});

    let resolveFirst!: () => void;
    const gate = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });

    const firstCall = withSyncLock(async () => {
      await gate;
      return "first";
    });

    // Let the first call synchronously claim the in-memory flag before the
    // second call is issued.
    await Promise.resolve();

    const secondResult = await withSyncLock(() => Promise.resolve("second"));
    expect(secondResult).toBeNull();

    resolveFirst();
    expect(await firstCall).toBe("first");
  });

  it("releases the in-memory flag after fn resolves, so a later call can run", async () => {
    vi.stubGlobal("navigator", {});

    await withSyncLock(() => Promise.resolve("first"));
    const second = await withSyncLock(() => Promise.resolve("second"));

    expect(second).toBe("second");
  });

  it("releases the in-memory flag even when fn throws", async () => {
    vi.stubGlobal("navigator", {});

    await expect(
      withSyncLock(() => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    const result = await withSyncLock(() => Promise.resolve("recovered"));
    expect(result).toBe("recovered");
  });

  it("treats navigator being undefined the same as locks being unavailable", async () => {
    vi.stubGlobal("navigator", undefined);

    const result = await withSyncLock(() => Promise.resolve("no-navigator"));
    expect(result).toBe("no-navigator");
  });
});
