import "server-only";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
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

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const isDemoMode =
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  if (isDemoMode) {
    const cookieStore = await cookies();
    const demoRole = cookieStore.get("mboyo_demo_role")?.value as Role | undefined;
    const demoEmail = cookieStore.get("mboyo_demo_email")?.value;

    if (demoRole) {
      return {
        userId: `demo-user-${demoRole}`,
        profileId: `demo-profile-${demoRole}`,
        email: demoEmail ?? `${demoRole}@mboyo.demo`,
        displayName: `Demo ${demoRole.replace("_", " ").toUpperCase()}`,
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
        .select("id, display_name")
        .eq("user_id", user.id)
        .single<ProfileRow>();

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
          email: user.email ?? null,
          displayName: profile.display_name,
          roles: (roleRows ?? []).map((row) => row.role),
        };
      }
    }
  } catch {}

  return null;
}

export async function requireAuthenticated(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sesi-berakhir");
  }
  return user;
}

export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireAuthenticated();
  const hasRole = roles.some((role) => user.roles.includes(role));
  if (!hasRole) {
    redirect("/tidak-diizinkan");
  }
  return user;
}

export async function requirePermission(entity: string, action: PermissionAction): Promise<CurrentUser> {
  const user = await requireAuthenticated();
  const permitted = user.roles.some((role) => roleHasPermission(role, entity, action));
  if (!permitted) {
    redirect("/tidak-diizinkan");
  }
  return user;
}
