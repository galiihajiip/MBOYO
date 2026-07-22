import "server-only";
import type { GrantRoleInput, RevokeRoleInput, Role } from "@mboyo/domain";
import { ApiError } from "../api/errors";
import type { CommandDbClient } from "../command/types";

interface ProfileRow {
  id: string;
  display_name: string;
  phone: string | null;
  created_at: string;
}

interface RoleAssignmentRow {
  id: string;
  profile_id: string;
  role: Role;
  granted_by: string | null;
  granted_at: string;
  revoked_at: string | null;
}

export interface UserWithRolesDto {
  profileId: string;
  displayName: string;
  phone: string | null;
  createdAt: string;
  roles: Role[];
}

const PRECONDITION_FAILED_SQLSTATE = "P0001";
const NOT_FOUND_SQLSTATE = "P0002";
const INSUFFICIENT_PRIVILEGE_SQLSTATE = "42501";
const VALIDATION_FAILED_SQLSTATE = "22023";

interface PostgrestLikeError {
  code?: string;
  message: string;
}

function translateRpcError(error: PostgrestLikeError, fallbackMessage: string): never {
  if (error.code === INSUFFICIENT_PRIVILEGE_SQLSTATE) {
    throw new ApiError("forbidden", "Anda tidak memiliki izin untuk melakukan tindakan ini.");
  }
  if (error.code === NOT_FOUND_SQLSTATE) {
    throw new ApiError("not_found", "Profil atau penetapan peran tidak ditemukan.");
  }
  if (error.code === VALIDATION_FAILED_SQLSTATE) {
    throw new ApiError("validation_failed", error.message);
  }
  if (error.code === PRECONDITION_FAILED_SQLSTATE) {
    throw new ApiError("invalid_transition", error.message);
  }
  throw new ApiError("internal_error", fallbackMessage);
}

/**
 * Lists every profile in the caller's own organization with their current
 * active roles — Admin's "Pengguna & Role" screen. profiles_admin_all RLS
 * already scopes "every profile" to what system_administrator may see;
 * this function does no additional role filtering itself.
 */
export async function listUsersWithRoles(db: CommandDbClient): Promise<UserWithRolesDto[]> {
  const { data: profiles, error: profilesError } = await db
    .from("profiles")
    .select("id, display_name, phone, created_at")
    .order("created_at", { ascending: true })
    .returns<ProfileRow[]>();

  if (profilesError) {
    throw new ApiError("internal_error", "Gagal memuat daftar pengguna.");
  }

  const { data: roleRows, error: roleError } = await db
    .from("role_assignments")
    .select("id, profile_id, role, granted_by, granted_at, revoked_at")
    .is("revoked_at", null)
    .returns<RoleAssignmentRow[]>();

  if (roleError) {
    throw new ApiError("internal_error", "Gagal memuat penetapan peran.");
  }

  const rolesByProfileId = new Map<string, Role[]>();
  for (const row of roleRows ?? []) {
    const existing = rolesByProfileId.get(row.profile_id) ?? [];
    existing.push(row.role);
    rolesByProfileId.set(row.profile_id, existing);
  }

  return (profiles ?? []).map((profile) => ({
    profileId: profile.id,
    displayName: profile.display_name,
    phone: profile.phone,
    createdAt: profile.created_at,
    roles: rolesByProfileId.get(profile.id) ?? [],
  }));
}

/** Grants a role to a profile — idempotent if already actively held. */
export async function grantRole(db: CommandDbClient, input: GrantRoleInput): Promise<void> {
  const { error } = await db.rpc("grant_role", { p_profile_id: input.profileId, p_role: input.role });

  if (error) {
    translateRpcError(error, "Gagal memberikan peran.");
  }
}

/** Revokes a profile's currently-active assignment of one role. */
export async function revokeRole(db: CommandDbClient, input: RevokeRoleInput): Promise<void> {
  const { error } = await db.rpc("revoke_role", { p_profile_id: input.profileId, p_role: input.role });

  if (error) {
    translateRpcError(error, "Gagal mencabut peran.");
  }
}
