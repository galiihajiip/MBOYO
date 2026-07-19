import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "../env.server";

/**
 * Service-role Supabase client — bypasses Row-Level Security entirely.
 *
 * This is the single highest-value credential in the system
 * (docs/security/THREAT_MODEL.md threat #6, docs/adr/0002-supabase-platform.md).
 * The `server-only` import above makes any accidental import from a Client
 * Component fail the Next.js build, and this module must never be imported
 * by anything reachable from `apps/web`'s client bundle.
 *
 * Use only for the small set of server-only routes that legitimately need
 * to bypass RLS (e.g. internal write paths documented per-route) — ordinary
 * request-scoped data access should go through the anon client
 * (./anon.server.ts or ./anon.browser.ts) so RLS stays the enforcement
 * layer, per AGENTS.md.
 */
let cached: SupabaseClient | undefined;

export function getServiceRoleClient(): SupabaseClient {
  if (cached) return cached;

  const env = getServerEnv();
  cached = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cached;
}
