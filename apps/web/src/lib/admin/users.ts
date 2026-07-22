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
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    return [
      {
        profileId: "demo-reporter",
        displayName: "Warga Pelapor Demo",
        phone: "08123456789",
        createdAt: new Date().toISOString(),
        roles: ["reporter"],
      },
      {
        profileId: "demo-verifier",
        displayName: "Petugas Verifikator Demo",
        phone: "08129876543",
        createdAt: new Date().toISOString(),
        roles: ["verifier"],
      },
      {
        profileId: "demo-coordinator",
        displayName: "Koordinator Respons Demo",
        phone: "08135555666",
        createdAt: new Date().toISOString(),
        roles: ["response_coordinator"],
      },
      {
        profileId: "demo-admin",
        displayName: "Administrator Sistem Demo",
        phone: "08112223334",
        createdAt: new Date().toISOString(),
        roles: ["system_administrator"],
      },
      {
        profileId: "demo-auditor",
        displayName: "Auditor Independen Demo",
        phone: "08199990000",
        createdAt: new Date().toISOString(),
        roles: ["auditor"],
      },
    ];
  }

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
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) return;

  const { error } = await db.rpc("grant_role", { p_profile_id: input.profileId, p_role: input.role });
  if (error) throw new ApiError("internal_error", "Gagal memberikan peran.");
}

export async function revokeRole(db: CommandDbClient, input: RevokeRoleInput): Promise<void> {
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) return;

  const { error } = await db.rpc("revoke_role", { p_profile_id: input.profileId, p_role: input.role });
  if (error) throw new ApiError("internal_error", "Gagal mencabut peran.");
}
