import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServerEnv } from "../env.server";

/**
 * Server-side Supabase client scoped to the current request's user session
 * (anon key + the caller's own auth cookie) — RLS applies exactly as it
 * would for the browser client, per docs/adr/0002-supabase-platform.md
 * ("RLS is load-bearing"). This is the client every ordinary Server
 * Component / Route Handler should use; only reach for
 * ./service-role.server.ts when a route has an explicit, documented reason
 * to bypass RLS.
 */
export async function createServerSupabaseClient() {
  const env = getServerEnv();
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component that can't set cookies (e.g. a
          // page render, not a Route Handler/Server Action) — session
          // refresh is handled by middleware instead, so this is safe to
          // ignore rather than throw.
        }
      },
    },
  });
}
