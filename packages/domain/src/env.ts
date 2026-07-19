import { z } from "zod";

/**
 * Server-side environment schema. Includes every secret listed in AGENTS.md —
 * these must never be imported from client/browser code.
 */
const serverEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_APP_ENV: z.enum(["development", "staging", "production"]),

  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  SUPABASE_REPORTS_BUCKET: z.string().min(1).default("report-evidence"),
  SUPABASE_EXPORTS_BUCKET: z.string().min(1).default("generated-exports"),

  ML_API_URL: z.string().url(),
  ML_INTERNAL_TOKEN: z.string().min(1),

  NEXT_PUBLIC_MAP_STYLE_URL: z.string().url().optional(),
  MAPTILER_API_KEY: z.string().optional(),

  SESSION_SIGNING_SECRET: z.string().min(1),
  CRON_SECRET: z.string().min(1),

  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
  GEMINI_FALLBACK_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  // BLOCK 22 — Gemini advisory call tuning. All have defaults so the app
  // boots and behaves sensibly with zero Gemini configuration at all
  // (GEMINI_API_KEY absent); these only matter once a key is present and
  // the feature is actually invoked by a Verifier.
  GEMINI_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  GEMINI_MAX_RETRIES: z.coerce.number().int().min(0).default(2),
  GEMINI_RATE_LIMIT_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().default(10),

  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),

  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  DEMO_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  NEXT_PUBLIC_DEMO_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

/**
 * Client-safe subset — only NEXT_PUBLIC_* variables. Never add a secret here;
 * anything exported from this schema is expected to reach the browser bundle.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_APP_ENV: z.enum(["development", "staging", "production"]),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_MAP_STYLE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  NEXT_PUBLIC_DEMO_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

/**
 * A `.env` file commonly leaves an optional variable present but blank
 * (e.g. `NEXT_PUBLIC_MAP_STYLE_URL=`, exactly as .env.example ships it) —
 * that produces an empty string, not an absent key, so a schema field like
 * `z.string().url().optional()` would otherwise reject it (empty string
 * fails .url(), and .optional() only permits undefined, not ""). Normalize
 * blank strings to undefined before validation so "left blank" and "not
 * set" behave identically for every optional field.
 */
function normalizeBlankOptionals(
  source: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const normalized: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(source)) {
    normalized[key] = value === "" ? undefined : value;
  }
  return normalized;
}

/**
 * Validates process.env against the full server schema. Throws with a
 * readable, field-by-field message on failure rather than surfacing a raw
 * Zod error — this is meant to fail loudly and immediately at server startup.
 */
export function loadServerEnv(
  source: Record<string, string | undefined> = process.env,
): ServerEnv {
  const parsed = serverEnvSchema.safeParse(normalizeBlankOptionals(source));
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid server environment configuration:\n${issues}\n\nSee .env.example for the full list of required variables.`,
    );
  }
  return parsed.data;
}

/**
 * Validates only the NEXT_PUBLIC_* subset — safe to call from code that may
 * run in the browser.
 */
export function loadClientEnv(
  source: Record<string, string | undefined> = process.env,
): ClientEnv {
  const parsed = clientEnvSchema.safeParse(normalizeBlankOptionals(source));
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid client environment configuration:\n${issues}\n\nSee .env.example for the full list of required variables.`,
    );
  }
  return parsed.data;
}
