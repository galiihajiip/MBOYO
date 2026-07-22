import { describe, expect, it } from "vitest";
import { loadServerEnv, loadClientEnv } from "./env";

const VALID_SERVER_ENV: Record<string, string> = {
  NEXT_PUBLIC_APP_URL: "https://mboyo.example.com",
  NEXT_PUBLIC_APP_ENV: "production",
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  DATABASE_URL: "postgres://user:pass@host:5432/db",
  ML_API_URL: "https://ml.mboyo.example.com",
  ML_INTERNAL_TOKEN: "internal-token",
  SESSION_SIGNING_SECRET: "session-secret",
  CRON_SECRET: "cron-secret",
};

const VALID_CLIENT_ENV: Record<string, string> = {
  NEXT_PUBLIC_APP_URL: "https://mboyo.example.com",
  NEXT_PUBLIC_APP_ENV: "production",
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
};

describe("loadServerEnv", () => {
  it("parses a valid, fully-specified environment", () => {
    const env = loadServerEnv(VALID_SERVER_ENV);
    expect(env.NEXT_PUBLIC_APP_URL).toBe("https://mboyo.example.com");
    expect(env.NEXT_PUBLIC_APP_ENV).toBe("production");
  });

  it("throws a readable, field-by-field error when a required field is missing", () => {
    const { DATABASE_URL: _omit, ...withoutDatabaseUrl } = VALID_SERVER_ENV;
    expect(() => loadServerEnv(withoutDatabaseUrl)).toThrow(/DATABASE_URL/);
  });

  it("throws when a required field fails its own validation (e.g. an invalid URL)", () => {
    expect(() => loadServerEnv({ ...VALID_SERVER_ENV, NEXT_PUBLIC_SUPABASE_URL: "not-a-url" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });

  it("throws with every failing field listed when multiple fields are invalid", () => {
    const { DATABASE_URL: _omit, ML_INTERNAL_TOKEN: _omit2, ...broken } = VALID_SERVER_ENV;
    try {
      loadServerEnv(broken);
      expect.fail("expected loadServerEnv to throw");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toMatch(/DATABASE_URL/);
      expect(message).toMatch(/ML_INTERNAL_TOKEN/);
    }
  });

  it("defaults SUPABASE_REPORTS_BUCKET and SUPABASE_EXPORTS_BUCKET when absent", () => {
    const env = loadServerEnv(VALID_SERVER_ENV);
    expect(env.SUPABASE_REPORTS_BUCKET).toBe("report-evidence");
    expect(env.SUPABASE_EXPORTS_BUCKET).toBe("generated-exports");
  });

  it("defaults GEMINI_FALLBACK_ENABLED to false and coerces the 'true' string to boolean", () => {
    expect(loadServerEnv(VALID_SERVER_ENV).GEMINI_FALLBACK_ENABLED).toBe(false);
    expect(loadServerEnv({ ...VALID_SERVER_ENV, GEMINI_FALLBACK_ENABLED: "true" }).GEMINI_FALLBACK_ENABLED).toBe(true);
  });

  it("defaults Gemini tuning fields (timeout/retries/rate limit) when absent", () => {
    const env = loadServerEnv(VALID_SERVER_ENV);
    expect(env.GEMINI_TIMEOUT_MS).toBe(15000);
    expect(env.GEMINI_MAX_RETRIES).toBe(2);
    expect(env.GEMINI_RATE_LIMIT_REQUESTS_PER_MINUTE).toBe(10);
  });

  it("coerces numeric string overrides for Gemini tuning fields", () => {
    const env = loadServerEnv({
      ...VALID_SERVER_ENV,
      GEMINI_TIMEOUT_MS: "5000",
      GEMINI_MAX_RETRIES: "0",
      GEMINI_RATE_LIMIT_REQUESTS_PER_MINUTE: "25",
    });
    expect(env.GEMINI_TIMEOUT_MS).toBe(5000);
    expect(env.GEMINI_MAX_RETRIES).toBe(0);
    expect(env.GEMINI_RATE_LIMIT_REQUESTS_PER_MINUTE).toBe(25);
  });

  it("leaves optional fields (SENTRY_DSN, MAPTILER_API_KEY, etc.) undefined when absent", () => {
    const env = loadServerEnv(VALID_SERVER_ENV);
    expect(env.SENTRY_DSN).toBeUndefined();
    expect(env.NEXT_PUBLIC_SENTRY_DSN).toBeUndefined();
    expect(env.MAPTILER_API_KEY).toBeUndefined();
    expect(env.NEXT_PUBLIC_MAP_STYLE_URL).toBeUndefined();
    expect(env.GEMINI_API_KEY).toBeUndefined();
    expect(env.UPSTASH_REDIS_REST_URL).toBeUndefined();
    expect(env.VAPID_PRIVATE_KEY).toBeUndefined();
    expect(env.RESEND_API_KEY).toBeUndefined();
  });

  it("treats a blank string for an optional field the same as an absent one", () => {
    const env = loadServerEnv({ ...VALID_SERVER_ENV, NEXT_PUBLIC_MAP_STYLE_URL: "", SENTRY_DSN: "" });
    expect(env.NEXT_PUBLIC_MAP_STYLE_URL).toBeUndefined();
    expect(env.SENTRY_DSN).toBeUndefined();
  });

  it("defaults DEMO_MODE and NEXT_PUBLIC_DEMO_MODE to false and coerces 'true'", () => {
    expect(loadServerEnv(VALID_SERVER_ENV).DEMO_MODE).toBe(false);
    expect(loadServerEnv({ ...VALID_SERVER_ENV, DEMO_MODE: "true" }).DEMO_MODE).toBe(true);
  });

  it("rejects an invalid NEXT_PUBLIC_APP_ENV value", () => {
    expect(() => loadServerEnv({ ...VALID_SERVER_ENV, NEXT_PUBLIC_APP_ENV: "sandbox" })).toThrow();
  });
});

describe("loadClientEnv", () => {
  it("parses a valid client environment", () => {
    const env = loadClientEnv(VALID_CLIENT_ENV);
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://project.supabase.co");
  });

  it("throws a readable error when a required client field is missing", () => {
    const { NEXT_PUBLIC_SUPABASE_ANON_KEY: _omit, ...withoutAnonKey } = VALID_CLIENT_ENV;
    expect(() => loadClientEnv(withoutAnonKey)).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it("defaults NEXT_PUBLIC_DEMO_MODE to false when absent", () => {
    expect(loadClientEnv(VALID_CLIENT_ENV).NEXT_PUBLIC_DEMO_MODE).toBe(false);
  });

  it("leaves optional client fields undefined when absent", () => {
    const env = loadClientEnv(VALID_CLIENT_ENV);
    expect(env.NEXT_PUBLIC_MAP_STYLE_URL).toBeUndefined();
    expect(env.NEXT_PUBLIC_SENTRY_DSN).toBeUndefined();
    expect(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY).toBeUndefined();
  });

  it("does not require server-only secrets (e.g. SUPABASE_SERVICE_ROLE_KEY) to be present", () => {
    expect(() => loadClientEnv(VALID_CLIENT_ENV)).not.toThrow();
  });
});
