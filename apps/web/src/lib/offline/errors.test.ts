import { describe, expect, it } from "vitest";
import { classifyError, SyncError } from "./errors";

describe("classifyError — permanent vs retryable classification", () => {
  it("classifies a SyncError by its explicit kind", () => {
    const permanent = classifyError(new SyncError("validation failed", "permanent"));
    expect(permanent.kind).toBe("permanent");
    expect(permanent.message).toBe("validation failed");

    const retryable = classifyError(new SyncError("server unavailable", "retryable"));
    expect(retryable.kind).toBe("retryable");
  });

  it("classifies a QuotaExceededError as retryable", () => {
    const error = new DOMException("quota exceeded", "QuotaExceededError");
    const classified = classifyError(error);
    expect(classified.kind).toBe("retryable");
  });

  it("defaults a generic Error to retryable (never silently permanent)", () => {
    const classified = classifyError(new Error("network request failed"));
    expect(classified.kind).toBe("retryable");
    expect(classified.message).toBe("network request failed");
  });

  it("defaults a non-Error thrown value to retryable with a safe message", () => {
    const classified = classifyError("a plain string was thrown");
    expect(classified.kind).toBe("retryable");
    expect(classified.message.length).toBeGreaterThan(0);
  });
});
