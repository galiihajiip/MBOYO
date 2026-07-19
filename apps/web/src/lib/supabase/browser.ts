import { createBrowserClient } from "@supabase/ssr";
import { getClientEnv } from "../env.client";

/**
 * Browser-safe Supabase client — anon key only, protected entirely by
 * Row-Level Security (docs/adr/0002-supabase-platform.md,
 * docs/security/THREAT_MODEL.md threat #4 broken access control). Never
 * import getServerEnv, SUPABASE_SERVICE_ROLE_KEY, or ./service-role.server
 * from this file or anything it's imported by — this module is reachable
 * from Client Components and its import graph must stay entirely
 * client-safe.
 */
export function createBrowserSupabaseClient() {
  const env = getClientEnv();
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
