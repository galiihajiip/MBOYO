import type { Metadata } from "next";
import { getCurrentUser } from "../../lib/auth/server";

export const metadata: Metadata = {
  title: "Administrasi — MBOYO",
};

export default async function AdminHomePage() {
  const user = await getCurrentUser();

  return (
    <div>
      <h1 className="font-sans text-2xl font-bold text-on-surface">
        Selamat datang, {user?.displayName}
      </h1>
      <p className="mt-2 font-sans text-sm text-on-surface-variant">
        Administrasi — ringkasan organisasi dan akses cepat ke pengelolaan pengguna, kejadian bencana, dan kesehatan sistem.
      </p>
    </div>
  );
}
