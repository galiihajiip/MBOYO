import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "../../lib/auth/server";

export const metadata: Metadata = {
  title: "Beranda — MBOYO",
};

export default async function ReporterHomePage() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-sans text-2xl font-bold text-on-surface">
          Selamat datang, {user?.displayName}
        </h1>
        <p className="mt-2 font-sans text-sm text-on-surface-variant">
          Buat laporan baru kapan saja — bahkan tanpa koneksi internet. Laporan Anda akan
          tersimpan dan terkirim otomatis begitu koneksi tersedia.
        </p>
      </div>

      <Link
        href="/reporter/laporan/baru"
        className="flex min-h-11 w-full items-center justify-center rounded-md bg-brand-ink-navy px-6 font-sans text-base font-semibold text-brand-cloud-white hover:bg-brand-deep-ocean sm:w-auto"
      >
        Buat Laporan Baru
      </Link>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/reporter/antrean"
          className="rounded-lg border border-brand-border bg-surface-container-lowest p-5 hover:bg-brand-mist"
        >
          <p className="font-sans text-sm font-semibold text-on-surface">Antrean Offline</p>
          <p className="mt-1 font-sans text-sm text-on-surface-variant">
            Lihat laporan yang menunggu sinkronisasi.
          </p>
        </Link>
        <Link
          href="/reporter/laporan"
          className="rounded-lg border border-brand-border bg-surface-container-lowest p-5 hover:bg-brand-mist"
        >
          <p className="font-sans text-sm font-semibold text-on-surface">Laporan Saya</p>
          <p className="mt-1 font-sans text-sm text-on-surface-variant">
            Riwayat lengkap laporan yang pernah Anda kirim.
          </p>
        </Link>
      </div>
    </div>
  );
}
