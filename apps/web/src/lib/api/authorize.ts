import "server-only";
import type { Role } from "@mboyo/domain";
import { createServerSupabaseClient } from "../supabase/server";
import { roleHasPermission, type PermissionAction } from "../auth/permissions";
import { ApiError } from "./errors";

export interface ApiActor {
  userId: string;
  profileId: string;
  organizationId: string;
  roles: Role[];
}

interface RoleAssignmentRow {
  role: Role;
}

/**
 * API-route equivalent of lib/auth/server.ts's requireAuthenticated —
 * deliberately a SEPARATE function rather than a shared one, because that
 * module's requireAuthenticated/requireRole/requirePermission call
 * next/navigation's redirect() on failure, which is correct for a
 * Server Component page but wrong for a JSON API route (a route handler
 * must return an ApiResult failure with the right HTTP status, never issue
 * an HTTP redirect for a fetch() caller). Throws ApiError instead, which
 * lib/api/respond.ts's respondError translates into the correct response.
 */
export async function requireApiActor(): Promise<ApiActor> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new ApiError("unauthenticated", "Sesi tidak valid. Silakan masuk kembali.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("user_id", user.id)
    .single<{ id: string; organization_id: string }>();
  if (!profile) {
    throw new ApiError("unauthenticated", "Profil tidak ditemukan.");
  }

  const { data: roleRows } = await supabase
    .from("role_assignments")
    .select("role")
    .eq("profile_id", profile.id)
    .is("revoked_at", null)
    .returns<RoleAssignmentRow[]>();

  return {
    userId: user.id,
    profileId: profile.id,
    organizationId: profile.organization_id,
    roles: (roleRows ?? []).map((row) => row.role),
  };
}

/** Requires the actor to hold at least one of the given roles; throws ApiError("forbidden") otherwise. */
export async function requireApiRole(...roles: Role[]): Promise<ApiActor> {
  const actor = await requireApiActor();
  if (!roles.some((role) => actor.roles.includes(role))) {
    throw new ApiError("forbidden", "Anda tidak memiliki izin untuk mengakses sumber daya ini.");
  }
  return actor;
}

/**
 * Requires the actor to hold a role permitted to perform (entity, action)
 * per docs/product/RBAC_MATRIX.md (via lib/auth/permissions.ts's
 * roleHasPermission) — the API-route counterpart of
 * lib/auth/server.ts's requirePermission.
 */
export async function requireApiPermission(entity: string, action: PermissionAction): Promise<ApiActor> {
  const actor = await requireApiActor();
  if (!actor.roles.some((role) => roleHasPermission(role, entity, action))) {
    throw new ApiError("forbidden", "Anda tidak memiliki izin untuk melakukan tindakan ini.");
  }
  return actor;
}
