"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@mboyo/domain";
import { ROLES } from "@mboyo/domain";
import { Badge, Button, Select, roleLabels } from "@mboyo/ui";

export interface UserRoleManagerProps {
  profileId: string;
  currentRoles: Role[];
}

const ROLE_OPTIONS = ROLES.map((role) => ({ value: role, label: roleLabels[role] }));

/**
 * Per-user role grant/revoke control (BLOCK 27) — "the one place
 * role_assignment is changed," per this screen's own long-standing stub
 * description. grant_role()/revoke_role() (this block's migration) are
 * both idempotent and always audited ('role_assignment.granted'/
 * '.revoked'), so a double-click or a role already held/already revoked
 * never produces a confusing duplicate or error.
 */
export function UserRoleManager({ profileId, currentRoles }: UserRoleManagerProps) {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<Role>("verifier");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGrant() {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${profileId}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole }),
      });
      const body = (await response.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) {
        setError(body.error?.message ?? "Gagal memberikan peran.");
        return;
      }
      router.refresh();
    } catch {
      setError("Gagal menghubungi server.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRevoke(role: Role) {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${profileId}/roles`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const body = (await response.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) {
        setError(body.error?.message ?? "Gagal mencabut peran.");
        return;
      }
      router.refresh();
    } catch {
      setError("Gagal menghubungi server.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {currentRoles.length === 0 ? (
          <span className="font-sans text-xs text-on-surface-variant">Belum ada peran.</span>
        ) : (
          currentRoles.map((role) => (
            <span key={role} className="flex items-center gap-1">
              <Badge tone="info">{roleLabels[role]}</Badge>
              <button
                type="button"
                onClick={() => void handleRevoke(role)}
                disabled={isSubmitting}
                aria-label={`Cabut peran ${roleLabels[role]}`}
                className="font-sans text-xs text-brand-critical-red underline disabled:opacity-50"
              >
                Cabut
              </button>
            </span>
          ))
        )}
      </div>

      <div className="flex items-center gap-2">
        <Select
          options={ROLE_OPTIONS}
          value={selectedRole}
          onValueChange={(value) => setSelectedRole(value as Role)}
          aria-label="Pilih peran untuk diberikan"
        />
        <Button type="button" variant="ghost" onClick={() => void handleGrant()} disabled={isSubmitting}>
          Berikan Peran
        </Button>
      </div>

      {error ? <p className="font-sans text-xs text-brand-critical-red">{error}</p> : null}
    </div>
  );
}
