import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareSupabaseClient } from "./lib/supabase/middleware";
import { findRequiredRolesForPath, isPublicPath, ROLE_HOME_ROUTE } from "./lib/auth/route-map";
import type { Role } from "@mboyo/domain";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  if (!origin) {
    return false;
  }
  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Indonesian route aliases mapping to actual Next.js app routes
  if (pathname.startsWith("/pelapor")) {
    const newPath = pathname.replace(/^\/pelapor/, "/reporter");
    return NextResponse.redirect(new URL(newPath, request.url));
  }
  if (pathname.startsWith("/verifikator")) {
    const newPath = pathname.replace(/^\/verifikator/, "/verifier");
    return NextResponse.redirect(new URL(newPath, request.url));
  }
  if (pathname.startsWith("/koordinator")) {
    const newPath = pathname.replace(/^\/koordinator/, "/command");
    return NextResponse.redirect(new URL(newPath, request.url));
  }
  if (pathname.startsWith("/administrator")) {
    const newPath = pathname.replace(/^\/administrator/, "/admin");
    return NextResponse.redirect(new URL(newPath, request.url));
  }

  if (pathname.startsWith("/api/") && MUTATING_METHODS.has(request.method) && !isSameOriginRequest(request)) {
    return NextResponse.json(
      { ok: false, error: { code: "forbidden", message: "Permintaan lintas asal tidak diizinkan." } },
      { status: 403 },
    );
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";
  const demoRoleCookie = request.cookies.get("mboyo_demo_role")?.value as Role | undefined;

  let activeUser = null;
  let userRoles: Role[] = [];

  if (isDemoMode && demoRoleCookie) {
    activeUser = { id: `demo-user-${demoRoleCookie}` };
    userRoles = [demoRoleCookie];
  } else {
    try {
      const { supabase } = createMiddlewareSupabaseClient(request);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        activeUser = user;
        const { data: roleRows } = await supabase
          .from("role_assignments")
          .select("role")
          .is("revoked_at", null);
        userRoles = (roleRows ?? []).map((row) => row.role as Role);
      }
    } catch {}
  }

  if (!activeUser) {
    const redirectUrl = new URL("/masuk", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  const requiredRoles = findRequiredRolesForPath(pathname);
  if (requiredRoles) {
    const hasRequiredRole = requiredRoles.some((role) => userRoles.includes(role));
    if (!hasRequiredRole) {
      return NextResponse.redirect(new URL("/tidak-diizinkan", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js).*)",
  ],
};

export { ROLE_HOME_ROUTE };
