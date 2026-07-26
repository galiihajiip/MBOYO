import type { Metadata } from "next";
import { ROLES } from "@mboyo/domain";
import { Users, ClipboardList, ShieldCheck, Star, Hub, Package, roleLabels } from "@mboyo/ui";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { listUsersWithRoles } from "../../../lib/admin/users";
import { getUserActivitySummary } from "../../../lib/admin/analytics";
import { UserDirectoryClient } from "../../../components/admin/UserDirectoryClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pengguna & Role — MBOYO" };

const ROLE_ICONS: Record<(typeof ROLES)[number], typeof Star> = {
  system_administrator: Star,
  response_coordinator: Hub,
  verifier: ShieldCheck,
  reporter: Users,
  auditor: ClipboardList,
};

/**
 * Static illustrative access-request/region snapshot — same rationale as
 * every other "Ilustratif" panel introduced in this redesign pass: this
 * schema has no access-request queue and no per-user region column
 * (profiles has no region/wilayah field at all), so these two panels
 * cannot be backed by a real query. Kept hardcoded and clearly labeled per
 * explicit user approval, isolated from the real user directory/role
 * counts/security audit count around them.
 */
const ACCESS_REQUEST_COUNT = 28;
const REGION_COVERAGE_SNAPSHOT = [
  { name: "Jakarta Selatan", userCount: 342, percent: 80 },
  { name: "Jakarta Timur", userCount: 298, percent: 70 },
];

interface SecurityAuditCountRow {
  action: string;
}

/**
 * Pengguna & Role (BLOCK 27, redesigned per the Admin "Manajemen Pengguna"
 * bento mockup) — the one screen role_assignment is changed, still only
 * ever through grant_role()/revoke_role() via UserDirectoryClient's
 * embedded UserRoleManager per row. Adds three real-data panels the old
 * stub-style page didn't have: total active users, per-role hierarchy
 * counts (getUserActivitySummary, already used by Kesehatan Sistem), and a
 * real count of role_assignment.granted/revoked + system_setting.*
 * audit_events in the last 24h as a genuine (not decorative) "Audit
 * Keamanan" figure.
 */
export default async function PenggunaRolePage() {
  const supabase = await createServerSupabaseClient();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [users, roleActivity, securityAuditResult] = await Promise.all([
    listUsersWithRoles(supabase),
    getUserActivitySummary(supabase),
    supabase
      .from("audit_events")
      .select("action")
      .gte("created_at", since24h)
      .or("action.like.role_assignment.%,action.like.system_setting.%")
      .returns<SecurityAuditCountRow[]>(),
  ]);

  const securityAuditCount = securityAuditResult.data?.length ?? 0;
  const maxRoleCount = Math.max(1, ...roleActivity.map((r) => r.activeUserCount));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-sans text-2xl font-bold text-on-surface">Manajemen Pengguna</h1>
        <p className="mt-1 font-sans text-sm text-on-surface-variant">
          Kelola hak akses dan direktori personil di seluruh peran MBOYO.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-2xl border border-brand-border bg-surface-container-lowest p-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-ink-navy text-white">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <p className="font-sans text-xs font-bold uppercase tracking-wide text-on-surface-variant">Total Pengguna</p>
            <p className="font-mono text-2xl font-bold text-on-surface">{users.length}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-brand-border bg-surface-container-lowest p-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-caution-amber/15 text-brand-caution-amber">
            <ClipboardList className="h-5 w-5" />
          </span>
          <div className="flex items-baseline gap-2">
            <div>
              <p className="font-sans text-xs font-bold uppercase tracking-wide text-on-surface-variant">Permintaan Akses Baru</p>
              <p className="font-mono text-2xl font-bold text-on-surface">
                {ACCESS_REQUEST_COUNT}{" "}
                <span className="rounded-full bg-brand-caution-amber/15 px-2 py-0.5 align-middle font-mono text-[10px] font-bold uppercase text-brand-caution-amber">
                  Ilustratif
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-brand-border bg-surface-container-lowest p-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-relief-teal/15 text-brand-relief-teal">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="font-sans text-xs font-bold uppercase tracking-wide text-on-surface-variant">Audit Keamanan (24 Jam)</p>
            <p className="font-mono text-2xl font-bold text-on-surface">
              {securityAuditCount}{" "}
              <span className="font-sans text-xs font-normal text-on-surface-variant">
                {securityAuditCount === 0 ? "Normal" : "peristiwa"}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <UserDirectoryClient users={users} />
        </div>

        <div className="flex flex-col gap-4 lg:col-span-4">
          <section className="rounded-2xl border border-brand-border bg-surface-container-lowest p-5">
            <h2 className="mb-4 font-sans text-base font-bold text-on-surface">Hirarki Peran</h2>
            <div className="flex flex-col gap-3">
              {ROLES.map((role) => {
                const Icon = ROLE_ICONS[role];
                const count = roleActivity.find((r) => r.role === role)?.activeUserCount ?? 0;
                const percent = Math.round((count / maxRoleCount) * 100);
                return (
                  <div key={role} className="rounded-xl border border-brand-border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-high text-brand-ink-navy">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="font-sans text-sm font-bold text-on-surface">{roleLabels[role]}</span>
                      </div>
                      <span className="font-mono text-sm font-bold text-on-surface">{count}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                      <div className="h-full rounded-full bg-brand-signal-cyan" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-brand-ink-navy bg-brand-ink-navy p-5 text-white">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-sans text-base font-bold">
                <Package className="h-4 w-4 text-brand-signal-cyan" />
                Cakupan Wilayah
              </h2>
              <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-white/70">
                Ilustratif
              </span>
            </div>
            <p className="mb-4 font-sans text-xs text-white/70">Sebaran personil aktif di seluruh sektor.</p>
            <div className="flex flex-col gap-3">
              {REGION_COVERAGE_SNAPSHOT.map((region) => (
                <div key={region.name}>
                  <div className="mb-1 flex justify-between font-sans text-xs">
                    <span>{region.name}</span>
                    <span className="font-bold">{region.userCount} User</span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-brand-signal-cyan" style={{ width: `${region.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
