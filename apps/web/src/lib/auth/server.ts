import "server-only";
import { redirect } from "next/navigation";
import type { Role } from "@mboyo/domain";
import { createServerSupabaseClient } from "../supabase/server";
import { roleHasPermission, type PermissionAction } from "./permissions";

export interface CurrentUser {
  /** Supabase auth.users.id */
  userId: string;
  /** public.profiles.id */
  profileId: string;
  email: string | null;
  displayName: string;
  /** Every active (non-revoked) role this profile currently holds. */
  roles: Role[];
}

interface ProfileRow {
  id: string;
  display_name: string;
}

interface RoleAssignmentRow {
  role: Role;
}

/**
 * Returns the current request's authenticated user + their active roles, or
 * null if there is no session. Never throws — callers that require
 * authentication should use requireAuthenticated() instead, which redirects.
 *
 * Uses supabase.auth.getUser() (re-validates the JWT server-side) rather
 * than getSession() (reads the cookie without revalidation), matching the
 * same reasoning as middleware.ts.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("user_id", user.id)
    .single<ProfileRow>();

  if (!profile) return null;

  const { data: roleRows } = await supabase
    .from("role_assignments")
    .select("role")
    .eq("profile_id", profile.id)
    .is("revoked_at", null)
    .returns<RoleAssignmentRow[]>();

  return {
    userId: user.id,
    profileId: profile.id,
    email: user.email ?? null,
    displayName: profile.display_name,
    roles: (roleRows ?? []).map((row) => row.role),
  };
}

/**
 * Requires an authenticated session; redirects to /sesi-berakhir (session
 * expired) if there is none. Use this at the top of any Server Component
 * page or Server Action that requires a signed-in user but not a specific role.
 */
export async function requireAuthenticated(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sesi-berakhir");
  }
  return user;
}

/**
 * Requires the authenticated user to hold at least one of the given roles;
 * redirects to /tidak-diizinkan (unauthorized) if they don't. This is the
 * server-side enforcement backing every role-specific route
 * (/reporter, /verifier, /command, /admin, /audit) — middleware.ts already
 * denies at the route-prefix level, but this is the defense-in-depth check
 * inside the page/route handler itself, so a route added later without a
 * middleware entry still fails closed rather than open.
 */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireAuthenticated();
  const hasRole = roles.some((role) => user.roles.includes(role));
  if (!hasRole) {
    redirect("/tidak-diizinkan");
  }
  return user;
}

/**
 * Requires the authenticated user to hold a role permitted to perform
 * (entity, action) per docs/product/RBAC_MATRIX.md (via
 * ./permissions.ts's roleHasPermission). Redirects to /tidak-diizinkan if
 * none of their roles grant it.
 *
 * Use this (rather than requireRole with a hardcoded role list) at the
 * point of an actual mutation/approval, so the permission check stays
 * anchored to the RBAC matrix's entity/action model instead of being
 * re-derived ad hoc per route — e.g. a Verifier's confirm action calls
 * requirePermission("report", "approve"), not requireRole("verifier").
 */
export async function requirePermission(entity: string, action: PermissionAction): Promise<CurrentUser> {
  const user = await requireAuthenticated();
  const permitted = user.roles.some((role) => roleHasPermission(role, entity, action));
  if (!permitted) {
    redirect("/tidak-diizinkan");
  }
  return user;
}
