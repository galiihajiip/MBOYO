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

export async function listUsersWithRoles(db: CommandDbClient): Promise<UserWithRolesDto[]> {
  try {
    const { data: profiles, error: profilesError } = await db
      .from("profiles")
      .select("id, display_name, phone, created_at")
      .order("created_at", { ascending: true })
      .returns<ProfileRow[]>();

    const { data: roleRows, error: roleError } = await db
      .from("role_assignments")
      .select("id, profile_id, role, granted_by, granted_at, revoked_at")
      .is("revoked_at", null)
      .returns<RoleAssignmentRow[]>();

    if (!profilesError && !roleError && profiles) {
      const rolesByProfileId = new Map<string, Role[]>();
      for (const row of roleRows ?? []) {
        const existing = rolesByProfileId.get(row.profile_id) ?? [];
        existing.push(row.role);
        rolesByProfileId.set(row.profile_id, existing);
      }

      return profiles.map((profile) => ({
        profileId: profile.id,
        displayName: profile.display_name,
        phone: profile.phone,
        createdAt: profile.created_at,
        roles: rolesByProfileId.get(profile.id) ?? [],
      }));
    }
  } catch {}

  throw new ApiError("internal_error", "Gagal memuat daftar pengguna.");
}

export async function grantRole(db: CommandDbClient, input: GrantRoleInput): Promise<void> {
  const { error } = await db.rpc("grant_role", { p_profile_id: input.profileId, p_role: input.role });
  if (error) throw new ApiError("internal_error", "Gagal memberikan peran.");
}

export async function revokeRole(db: CommandDbClient, input: RevokeRoleInput): Promise<void> {
  const { error } = await db.rpc("revoke_role", { p_profile_id: input.profileId, p_role: input.role });
  if (error) throw new ApiError("internal_error", "Gagal mencabut peran.");
}
