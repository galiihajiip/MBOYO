"use client";

import { useMemo, useState } from "react";
import type { Role } from "@mboyo/domain";
import { ROLES } from "@mboyo/domain";
import { Input, Select, Badge, roleLabels } from "@mboyo/ui";
import { UserRoleManager } from "./UserRoleManager";
import type { UserWithRolesDto } from "../../lib/admin/users";

export interface UserDirectoryClientProps {
  users: UserWithRolesDto[];
}

const ROLE_FILTER_OPTIONS = [{ value: "all", label: "Semua Peran" }, ...ROLES.map((role) => ({ value: role, label: roleLabels[role] }))];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/**
 * Client-side search/role filter over the full user directory
 * (listUsersWithRoles has no server pagination today, and this demo's
 * dataset is small enough that filtering the already-fetched list client
 * side is simpler than adding query-param-driven server filtering for a
 * UI-only redesign). Grant/revoke stays wired to the same real
 * UserRoleManager every row already used.
 */
export function UserDirectoryClient({ users }: UserDirectoryClientProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch = query === "" || user.displayName.toLowerCase().includes(query) || user.profileId.toLowerCase().includes(query);
      const matchesRole = roleFilter === "all" || user.roles.includes(roleFilter as Role);
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[240px] flex-1">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nama atau ID pengguna..."
            aria-label="Cari pengguna"
          />
        </div>
        <div className="w-48">
          <Select
            options={ROLE_FILTER_OPTIONS}
            value={roleFilter}
            onValueChange={setRoleFilter}
            aria-label="Filter berdasarkan peran"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-brand-border p-6 text-center font-sans text-sm text-on-surface-variant">
          Tidak ada pengguna yang cocok dengan pencarian.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-brand-border">
          <table className="w-full text-left">
            <thead className="border-b border-brand-border bg-surface-container-low">
              <tr>
                <th className="px-4 py-3 font-sans text-xs font-bold uppercase tracking-wide text-on-surface-variant">Nama</th>
                <th className="px-4 py-3 font-sans text-xs font-bold uppercase tracking-wide text-on-surface-variant">Peran</th>
                <th className="px-4 py-3 font-sans text-xs font-bold uppercase tracking-wide text-on-surface-variant">Terdaftar</th>
                <th className="px-4 py-3 font-sans text-xs font-bold uppercase tracking-wide text-on-surface-variant">Kelola Peran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {filtered.map((user) => (
                <tr key={user.profileId} className="align-top">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-ink-navy font-sans text-xs font-bold text-white">
                        {initials(user.displayName)}
                      </span>
                      <div>
                        <p className="font-sans text-sm font-bold text-on-surface">{user.displayName}</p>
                        <p className="font-mono text-[11px] text-on-surface-variant">{user.profileId.slice(0, 8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {user.roles.length === 0 ? (
                      <span className="font-sans text-xs text-on-surface-variant">Belum ada peran</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {user.roles.map((role) => (
                          <Badge key={role} tone="info">
                            {roleLabels[role]}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 font-mono text-xs text-on-surface-variant">
                    {new Date(user.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-4">
                    <UserRoleManager profileId={user.profileId} currentRoles={user.roles} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="font-sans text-xs text-on-surface-variant">
        Menampilkan {filtered.length} dari {users.length} pengguna.
      </p>
    </div>
  );
}
