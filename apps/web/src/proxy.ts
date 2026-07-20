import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareSupabaseClient } from "./lib/supabase/middleware";
import { findRequiredRolesForPath, isPublicPath, ROLE_HOME_ROUTE } from "./lib/auth/route-map";
import type { Role } from "@mboyo/domain";

/**
 * Server-side route protection, per this block's requirements:
 * "installed Next.js-compatible middleware/proxy pattern" +
 * "server-side route denial." This runs on every request matched by
 * `config.matcher` below, BEFORE any page/route handler executes — a user
 * cannot bypass this by disabling JavaScript or crafting a direct request,
 * unlike a client-side-only redirect.
 *
 * This is a coarse first line of defense (route-prefix → allowed roles).
 * The authoritative enforcement remains Postgres RLS
 * (docs/adr/0002-supabase-platform.md) plus the requireRole()/
 * requirePermission() server helpers used inside each page/route handler —
 * middleware existing does not relax that requirement, per
 * docs/product/RBAC_MATRIX.md.
 */
export async function proxy(request: NextRequest) {
  const { supabase, getResponse } = createMiddlewareSupabaseClient(request);
  const pathname = request.nextUrl.pathname;

  // getUser() (not getSession()) re-validates the JWT against Supabase Auth
  // on every call — getSession() alone would trust a possibly-stale/forged
  // cookie without a server round-trip, which is not an acceptable check
  // for a route-protection gate.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isPublicPath(pathname)) {
    return getResponse();
  }

  if (!user) {
    const redirectUrl = new URL("/masuk", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  const requiredRoles = findRequiredRolesForPath(pathname);
  if (requiredRoles) {
    const { data: roleRows } = await supabase
      .from("role_assignments")
      .select("role")
      .is("revoked_at", null);

    const userRoles = (roleRows ?? []).map((row) => row.role as Role);
    const hasRequiredRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRequiredRole) {
      return NextResponse.redirect(new URL("/tidak-diizinkan", request.url));
    }
  }

  return getResponse();
}

export const config = {
  matcher: [
    /*
     * Match every request path except static assets and Next.js internals —
     * a route not explicitly listed as public (route-map.ts) is protected
     * by default, satisfying "fail closed, not open" for any route added
     * later without an explicit public/protected classification.
     */
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js).*)",
  ],
};

// Re-exported for callers that need a role's home route without importing
// the whole route-map module (e.g. the login page redirect-after-auth logic).
export { ROLE_HOME_ROUTE };
