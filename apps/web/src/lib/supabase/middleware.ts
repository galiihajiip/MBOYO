import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { loadClientEnv } from "@mboyo/domain";

/** See lib/supabase/server.ts's identical constant for the full rationale — secure: true in production, httpOnly deliberately left as @supabase/ssr's default (false) since the browser client reads this cookie directly. */
const HARDENED_COOKIE_OPTIONS: Partial<CookieOptions> = {
  secure: process.env.NODE_ENV === "production",
};

/**
 * Refreshes the Supabase session cookie on every request that passes
 * through middleware.ts, and returns both the (possibly rewritten) response
 * and a Supabase client bound to this request/response pair so
 * middleware.ts can also read the current user for route-protection
 * decisions without a second client construction.
 *
 * This is the standard @supabase/ssr Next.js middleware pattern — session
 * refresh MUST happen in middleware (not only in Server Components) because
 * Server Components cannot write cookies; without this, a session nearing
 * expiry would silently stop refreshing and the user would be logged out
 * unexpectedly mid-session.
 */
export function createMiddlewareSupabaseClient(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Uses loadClientEnv (not loadServerEnv) deliberately: the proxy only
  // ever needs the Supabase URL + anon key to read/refresh the session
  // cookie, never SUPABASE_SERVICE_ROLE_KEY or any other server-only
  // secret. Requiring the full server env here would make the proxy (and
  // therefore every route it runs in front of, including public marketing
  // pages) fail whenever those unrelated secrets aren't configured.
  const env = loadClientEnv(process.env);

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, { ...options, ...HARDENED_COOKIE_OPTIONS });
        }
      },
    },
  });

  return { supabase, getResponse: () => response };
}
