import type { Metadata } from "next";
import { getCurrentUser } from "../../../lib/auth/server";

export const metadata: Metadata = { title: "Profil — MBOYO" };

/**
 * Reporter profile view — per docs/product/SCREEN_INVENTORY.md "Shared
 * Profil Pattern": read-only display for this block (full edit form for
 * display_name/phone is a small follow-up, out of this block's scope,
 * which is the report wizard).
 */
export default async function ReporterProfilPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-sans text-2xl font-bold text-on-surface">Profil</h1>
      <div className="rounded-lg border border-brand-border bg-surface-container-lowest p-5">
        <p className="font-sans text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          Nama Tampilan
        </p>
        <p className="mt-1 font-sans text-base text-on-surface">{user?.displayName}</p>
        <p className="mt-4 font-sans text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          Email
        </p>
        <p className="mt-1 font-sans text-base text-on-surface">{user?.email}</p>
      </div>
    </div>
  );
}
