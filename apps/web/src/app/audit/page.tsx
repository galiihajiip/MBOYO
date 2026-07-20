import type { Metadata } from "next";
import { getCurrentUser } from "../../lib/auth/server";

export const metadata: Metadata = {
  title: "Audit Trail — MBOYO",
};

/**
 * Per this and prior blocks' "Auditor cannot mutate" acceptance criterion:
 * this page and every /audit/* route must render zero mutating
 * affordances — no create/edit/delete/approve/assign/configure control
 * anywhere.
 */
export default async function AuditHomePage() {
  const user = await getCurrentUser();

  return (
    <div>
      <h1 className="font-sans text-2xl font-bold text-on-surface">
        Selamat datang, {user?.displayName}
      </h1>
      <p className="mt-2 font-sans text-sm text-on-surface-variant">
        Jejak Audit — Mode Audit — Hanya Baca. Linimasa lengkap lineage laporan menyusul pada
        blok berikutnya.
      </p>
    </div>
  );
}
