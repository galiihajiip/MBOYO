import "server-only";
import { cookies } from "next/headers";
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

export async function requireApiActor(): Promise<ApiActor> {
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    const cookieStore = await cookies();
    const demoRole = cookieStore.get("mboyo_demo_role")?.value as Role | undefined;
    if (demoRole) {
      return {
        userId: `demo-user-${demoRole}`,
        profileId: `demo-profile-${demoRole}`,
        organizationId: "demo-org-1",
        roles: [demoRole],
      };
    }
  }

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, organization_id")
        .eq("user_id", user.id)
        .single<{ id: string; organization_id: string }>();

      if (profile) {
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
    }
  } catch {}

  throw new ApiError("unauthenticated", "Sesi tidak valid. Silakan masuk kembali.");
}

export async function requireApiRole(...roles: Role[]): Promise<ApiActor> {
  const actor = await requireApiActor();
  if (!roles.some((role) => actor.roles.includes(role))) {
    throw new ApiError("forbidden", "Anda tidak memiliki izin untuk mengakses sumber daya ini.");
  }
  return actor;
}

export async function requireApiPermission(entity: string, action: PermissionAction): Promise<ApiActor> {
  const actor = await requireApiActor();
  if (!actor.roles.some((role) => roleHasPermission(role, entity, action))) {
    throw new ApiError("forbidden", "Anda tidak memiliki izin untuk melakukan tindakan ini.");
  }
  return actor;
}
