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
/**
 * Cookie hardening (BLOCK 28) — @supabase/ssr's own DEFAULT_COOKIE_OPTIONS
 * is `{ path: "/", sameSite: "lax", httpOnly: false }` (confirmed by
 * reading its source: node_modules/@supabase/ssr's dist utils/constants.js —
 * no `secure` attribute is set either). `sameSite: "lax"` is kept as-is
 * (already a real CSRF mitigation, and this codebase's own proxy.ts adds an
 * explicit Origin check as a second layer — see that file's comment).
 * `secure: true` in production is added explicitly here (harmless — every
 * deployment target for this app is HTTPS-only). `httpOnly` is
 * DELIBERATELY NOT forced to `true`: createBrowserClient() (browser.ts)
 * stores the session by reading/writing this exact cookie directly via
 * `document.cookie` (confirmed by reading @supabase/ssr's
 * createBrowserClient.js — it uses a cookie-backed storage adapter, not
 * httpOnly-compatible token exchange) — forcing httpOnly here would break
 * every Client Component's ability to read its own session client-side.
 * Making the auth cookie httpOnly would require replacing @supabase/ssr's
 * cookie-based browser session model entirely (e.g. a server-issued,
 * short-lived exchange token) — a real architectural change, disclosed as
 * out of this block's scope in SECURITY_CHECKLIST.md rather than silently
 * left undocumented.
 */
const HARDENED_COOKIE_OPTIONS: Partial<CookieOptions> = {
  secure: process.env.NODE_ENV === "production",
};

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
            cookieStore.set(name, value, { ...options, ...HARDENED_COOKIE_OPTIONS });
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
