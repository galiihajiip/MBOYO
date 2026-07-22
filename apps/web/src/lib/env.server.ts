import "server-only";
import { loadServerEnv, type ServerEnv } from "@mboyo/domain";

let cached: ServerEnv | undefined;

/**
 * Lazily validates and returns the server-side environment. Deliberately not
 * evaluated at module load time so `next build` (which has no real secrets
 * available, e.g. in CI) does not fail just from importing this module —
 * call this only from the request/handler code path that actually needs it.
 */
export function getServerEnv(): ServerEnv {
  cached ??= loadServerEnv({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV || "development",
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvY2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MjU0OTEyMDAsImV4cCI6MTk0MTA2NzIwMH0.placeholder",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvY2FsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTYyNTQ5MTIwMCwiZXhwIjoxOTQxMDY3MjAwfQ.placeholder",
    DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    ML_API_URL: process.env.ML_API_URL || "http://localhost:8000",
    ML_INTERNAL_TOKEN: process.env.ML_INTERNAL_TOKEN || "mboyo-ml-internal-token-local-dev",
    SESSION_SIGNING_SECRET: process.env.SESSION_SIGNING_SECRET || "mboyo-session-signing-secret-local-dev-32-chars",
    CRON_SECRET: process.env.CRON_SECRET || "mboyo-cron-secret-local-dev",
    DEMO_MODE: process.env.DEMO_MODE || "true",
    NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE || "true",
    ...process.env,
  });
  return cached;
}
