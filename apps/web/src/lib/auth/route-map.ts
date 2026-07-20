import type { Role } from "@mboyo/domain";

/**
 * Role → default landing route, per this block's requirements. Also used
 * by requireRole()/middleware to determine "where does this role belong"
 * when redirecting away from an unauthorized route.
 */
export const ROLE_HOME_ROUTE: Record<Role, string> = {
  reporter: "/reporter",
  verifier: "/verifier",
  response_coordinator: "/command",
  system_administrator: "/admin",
  auditor: "/audit",
};

/**
 * Route-prefix → roles allowed to access it. Checked by middleware.ts
 * before a request ever reaches a page/route handler (server-side denial,
 * not just a client-side redirect a user could bypass by disabling JS).
 *
 * This is a coarse, prefix-based first line of defense — the authoritative
 * enforcement is still Postgres RLS (docs/adr/0002-supabase-platform.md)
 * plus the requireRole()/requirePermission() server helpers used inside
 * each route/page. Middleware existing does not relax that requirement.
 */
export const PROTECTED_ROUTE_ROLES: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: "/reporter", roles: ["reporter"] },
  { prefix: "/verifier", roles: ["verifier"] },
  { prefix: "/command", roles: ["response_coordinator"] },
  { prefix: "/admin", roles: ["system_administrator"] },
  { prefix: "/audit", roles: ["auditor"] },
];

/**
 * Public routes that never require authentication — anything not listed in
 * PROTECTED_ROUTE_ROLES and not in this list still requires *some*
 * authenticated session (see middleware.ts), matching the "server-side
 * route denial" requirement: unrecognized routes fail closed, not open.
 */
export const PUBLIC_ROUTE_PREFIXES = [
  "/",
  "/masuk",
  "/lupa-kata-sandi",
  "/reset-kata-sandi",
  "/tidak-diizinkan",
  "/sesi-berakhir",
  "/design-system",
  "/api/health",
  "/privacy",
  "/methodology",
  "/data-governance",
  "/accessibility",
  "/sitemap.xml",
  "/robots.txt",
  "/sw.js",
  "/offline.html",
];

export function findRequiredRolesForPath(pathname: string): Role[] | null {
  const match = PROTECTED_ROUTE_ROLES.find(
    (entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`),
  );
  return match ? match.roles : null;
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || (prefix !== "/" && pathname.startsWith(`${prefix}/`)),
  );
}
