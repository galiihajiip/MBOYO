import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "../../lib/auth/server";
import { ROLE_HOME_ROUTE } from "../../lib/auth/route-map";

export const metadata: Metadata = {
  title: "Tidak Diizinkan — MBOYO",
};

export const dynamic = "force-dynamic";

/**
 * Unauthorized (403) screen per docs/product/SCREEN_INVENTORY.md
 * "Unauthorized (403 — Role Mismatch)": a generic message only, never
 * revealing entity data, counts, or any hint of what the restricted route
 * would have shown.
 */
export default async function UnauthorizedPage() {
  const user = await getCurrentUser();
  const homeRoute = user?.roles[0] ? ROLE_HOME_ROUTE[user.roles[0]] : "/masuk";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-sans text-2xl font-bold text-on-surface">Akses Ditolak</h1>
      <p className="max-w-sm font-sans text-sm text-on-surface-variant">
        Anda tidak memiliki akses ke halaman ini.
      </p>
      <Link
        href={homeRoute}
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand-ink-navy px-4 font-sans text-sm font-semibold text-brand-cloud-white hover:bg-brand-deep-ocean"
      >
        Kembali ke Beranda
      </Link>
    </main>
  );
}
