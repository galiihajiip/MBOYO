import { describe, expect, it, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import { logger, redactFields } from "./logger";

describe("redactFields", () => {
  it("redacts keys matching common secret patterns", () => {
    const result = redactFields({
      password: "hunter2",
      token: "abc",
      apiKey: "xyz",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
      authorization: "Bearer abc",
      cookie: "session=abc",
      dsn: "https://sentry.example/1",
    });

    expect(result).toEqual({
      password: "[redacted]",
      token: "[redacted]",
      apiKey: "[redacted]",
      SUPABASE_SERVICE_ROLE_KEY: "[redacted]",
      authorization: "[redacted]",
      cookie: "[redacted]",
      dsn: "[redacted]",
    });
  });

  it("redacts known PII field names even without a 'secret'-like name", () => {
    const result = redactFields({ email: "user@example.com", phone: "0812", reportId: "abc-123" });
    expect(result).toEqual({ email: "[redacted]", phone: "[redacted]", reportId: "abc-123" });
  });

  it("redacts nested object fields recursively", () => {
    const result = redactFields({ actor: { profileId: "p1", email: "user@example.com" } });
    expect(result).toEqual({ actor: { profileId: "p1", email: "[redacted]" } });
  });

  it("redacts fields inside arrays", () => {
    const result = redactFields({ users: [{ email: "a@example.com" }, { email: "b@example.com" }] });
    expect(result).toEqual({ users: [{ email: "[redacted]" }, { email: "[redacted]" }] });
  });

  it("leaves non-sensitive fields untouched", () => {
    const result = redactFields({ requestId: "req-1", statusCode: 200, ok: true });
    expect(result).toEqual({ requestId: "req-1", statusCode: 200, ok: true });
  });

  it("does not throw on a circular reference", () => {
    const circular: Record<string, unknown> = { name: "x" };
    circular.self = circular;
    expect(() => redactFields({ circular })).not.toThrow();
  });
});

describe("logger", () => {
  let logSpy: MockInstance<typeof console.log>;
  let errorSpy: MockInstance<typeof console.error>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("emits one JSON line per call with timestamp/level/service/message", () => {
    logger.info("report created", { requestId: "req-1", reportId: "r1" });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(logSpy.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(parsed.level).toBe("info");
    expect(parsed.service).toBe("apps/web");
    expect(parsed.message).toBe("report created");
    expect(parsed.requestId).toBe("req-1");
    expect(typeof parsed.timestamp).toBe("string");
  });

  it("routes error-level logs to console.error", () => {
    logger.error("upload failed", { requestId: "req-2" });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("redacts sensitive fields before serializing", () => {
    logger.info("login attempt", { email: "user@example.com", requestId: "req-3" });
    const parsed = JSON.parse(logSpy.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(parsed.email).toBe("[redacted]");
  });

  it("strips raw binary field values instead of logging bytes", () => {
    logger.info("evidence processed", { buffer: new Uint8Array([1, 2, 3]) });
    const parsed = JSON.parse(logSpy.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(parsed.buffer).toBe("[binary 3 bytes omitted]");
  });
});
