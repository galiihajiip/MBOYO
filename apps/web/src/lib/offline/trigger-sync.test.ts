import { afterEach, describe, expect, it, vi } from "vitest";
import { triggerBackgroundSync } from "./trigger-sync";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("triggerBackgroundSync", () => {
  it("does nothing when navigator.serviceWorker isn't available", async () => {
    vi.stubGlobal("navigator", {});
    await expect(triggerBackgroundSync()).resolves.toBeUndefined();
  });

  it("does nothing when navigator itself is undefined", async () => {
    vi.stubGlobal("navigator", undefined);
    await expect(triggerBackgroundSync()).resolves.toBeUndefined();
  });

  it("does nothing when navigator.serviceWorker.ready rejects (no registration)", async () => {
    const postMessage = vi.fn();
    vi.stubGlobal("navigator", {
      serviceWorker: {
        ready: Promise.reject(new Error("no service worker")),
      },
    });

    await expect(triggerBackgroundSync()).resolves.toBeUndefined();
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("registers Background Sync via registration.sync.register with the expected tag when supported", async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    const postMessage = vi.fn();
    const registration = {
      sync: { register },
      active: { postMessage },
    };
    vi.stubGlobal("navigator", {
      serviceWorker: { ready: Promise.resolve(registration) },
    });

    await triggerBackgroundSync();

    expect(register).toHaveBeenCalledWith("mboyo-report-queue-replay");
    // Falls through to postMessage only on failure — successful
    // registration should not also post a message.
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("falls back to postMessage when Background Sync (the `sync` property) isn't supported", async () => {
    const postMessage = vi.fn();
    const registration = {
      active: { postMessage },
    };
    vi.stubGlobal("navigator", {
      serviceWorker: { ready: Promise.resolve(registration) },
    });

    await triggerBackgroundSync();

    expect(postMessage).toHaveBeenCalledWith({ type: "MBOYO_REQUEST_SYNC" });
  });

  it("falls back to postMessage when registration.sync.register itself rejects", async () => {
    const register = vi.fn().mockRejectedValue(new Error("permission policy blocked sync"));
    const postMessage = vi.fn();
    const registration = {
      sync: { register },
      active: { postMessage },
    };
    vi.stubGlobal("navigator", {
      serviceWorker: { ready: Promise.resolve(registration) },
    });

    await triggerBackgroundSync();

    expect(register).toHaveBeenCalledWith("mboyo-report-queue-replay");
    expect(postMessage).toHaveBeenCalledWith({ type: "MBOYO_REQUEST_SYNC" });
  });

  it("does not throw when falling back and registration.active is null", async () => {
    const registration = { active: null };
    vi.stubGlobal("navigator", {
      serviceWorker: { ready: Promise.resolve(registration) },
    });

    await expect(triggerBackgroundSync()).resolves.toBeUndefined();
  });
});
