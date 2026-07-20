import type { Metadata } from "next";
import { getCurrentUser } from "../../lib/auth/server";

export const metadata: Metadata = {
  title: "Administrasi — MBOYO",
};

/**
 * Per this and prior blocks' acceptance criterion ("Admin cannot
 * validate/dispatch without a separately assigned role"), nothing on this
 * page or any /admin/* route may expose report-validation or
 * response_task/task_assignment dispatch actions — see
 * docs/product/RBAC_MATRIX.md and lib/auth/permissions.ts.
 */
export default async function AdminHomePage() {
  const user = await getCurrentUser();

  return (
    <div>
      <h1 className="font-sans text-2xl font-bold text-on-surface">
        Selamat datang, {user?.displayName}
      </h1>
      <p className="mt-2 font-sans text-sm text-on-surface-variant">
        Administrasi — ringkasan organisasi dan tautan cepat ke pengelolaan pengguna, event, dan
        kesehatan sistem menyusul pada blok berikutnya.
      </p>
    </div>
  );
}
