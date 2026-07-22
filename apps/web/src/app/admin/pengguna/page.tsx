import type { Metadata } from "next";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { listUsersWithRoles } from "../../../lib/admin/users";
import { UserRoleManager } from "../../../components/admin/UserRoleManager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pengguna & Role — MBOYO" };

/**
 * Pengguna & Role (BLOCK 27) — replacing the earlier stub. The one screen
 * where role_assignment is changed, per this screen's own long-documented
 * description. Admin cannot validate/dispatch here — this page only ever
 * calls grant_role()/revoke_role(), never touches reports/response_tasks/
 * verification_reviews.
 */
export default async function PenggunaRolePage() {
  const supabase = await createServerSupabaseClient();
  const users = await listUsersWithRoles(supabase);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-sans text-2xl font-bold text-on-surface">Pengguna & Role</h1>

      <ul className="flex flex-col gap-3">
        {users.map((user) => (
          <li key={user.profileId} className="flex flex-col gap-2 rounded-md border border-brand-border bg-surface-container-lowest p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-sans text-sm font-semibold text-on-surface">{user.displayName}</span>
              <span className="font-mono text-xs text-on-surface-variant">{user.profileId}</span>
            </div>
            <UserRoleManager profileId={user.profileId} currentRoles={user.roles} />
          </li>
        ))}
      </ul>
    </div>
  );
}
