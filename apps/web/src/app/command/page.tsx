import type { Metadata } from "next";
import { getCurrentUser } from "../../lib/auth/server";

export const metadata: Metadata = {
  title: "Command Center — MBOYO",
};

export default async function CommandCenterPage() {
  const user = await getCurrentUser();

  return (
    <div>
      <h1 className="font-sans text-2xl font-bold text-on-surface">
        Selamat datang, {user?.displayName}
      </h1>
      <p className="mt-2 font-sans text-sm text-on-surface-variant">
        Command Center — insiden terverifikasi yang memerlukan perhatian dan ringkasan tugas
        aktif menyusul pada blok berikutnya.
      </p>
    </div>
  );
}
