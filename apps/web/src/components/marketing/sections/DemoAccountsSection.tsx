import Link from "next/link";
import { RoleBadge } from "@mboyo/ui";
import type { Role } from "@mboyo/domain";

const DEMO_ROLES: {
  role: Role;
  name: string;
  email: string;
  desc: string;
  dest: string;
  badgeTone: string;
}[] = [
  {
    role: "reporter",
    name: "Pelapor Warga",
    email: "reporter@mboyo.demo",
    desc: "Buat laporan kerusakan offline, kelola antrean lokal, dan lihat riwayat laporan.",
    dest: "/reporter",
    badgeTone: "border-brand-signal-cyan/40 bg-brand-signal-cyan/5",
  },
  {
    role: "verifier",
    name: "Petugas Verifikator",
    email: "verifier@mboyo.demo",
    desc: "Tinjau bukti foto, hasil analisis AI, dan ambil keputusan verifikasi resmi.",
    dest: "/verifier",
    badgeTone: "border-brand-relief-teal/40 bg-brand-relief-teal/5",
  },
  {
    role: "response_coordinator",
    name: "Koordinator Respons",
    email: "coordinator@mboyo.demo",
    desc: "Kelola Command Center, peta krisis PostGIS, klaster insiden, & penugasan tim.",
    dest: "/command",
    badgeTone: "border-brand-caution-amber/40 bg-brand-caution-amber/5",
  },
  {
    role: "system_administrator",
    name: "Administrator Sistem",
    email: "admin@mboyo.demo",
    desc: "Kelola akun pengguna, penetapan peran, kejadian bencana, & kesehatan sistem.",
    dest: "/admin",
    badgeTone: "border-brand-priority-orange/40 bg-brand-priority-orange/5",
  },
  {
    role: "auditor",
    name: "Auditor Independen",
    email: "auditor@mboyo.demo",
    desc: "Akses riwayat audit (audit trail), evaluasi model AI, & ekspor kepatuhan data.",
    dest: "/audit",
    badgeTone: "border-brand-slate/40 bg-brand-slate/5",
  },
];

/**
 * "Demo accounts" section — inspired by Hornet & BuildPro pricing/role plans grid.
 * Displays 5 role demo access cards with instant login links.
 */
export function DemoAccountsSection() {
  const demoMode =
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  return (
    <section id="akun-demo" className="bg-surface-container-low py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-caution-amber/60 bg-brand-caution-amber/15 px-3 py-1 font-mono text-xs font-bold text-[#7a5109]">
            AKSES DEMO INSTAN
          </span>
          <h2 className="mt-3 font-sans text-2xl font-extrabold text-on-surface sm:text-3xl lg:text-4xl">
            Coba MBOYO Sesuai Peran Anda
          </h2>
          <p className="mt-3 font-sans text-base text-on-surface-variant">
            Uji seluruh fitur platform dari 5 perspektif peran yang berbeda secara langsung.
          </p>
        </div>

        {demoMode ? (
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {DEMO_ROLES.map((item) => (
              <div
                key={item.email}
                className={`flex flex-col justify-between rounded-2xl border p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl bg-surface-container-lowest ${item.badgeTone}`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <RoleBadge role={item.role} />
                    <span className="font-mono text-[10px] font-bold text-on-surface-variant">
                      Demo Mode
                    </span>
                  </div>
                  <h3 className="mt-4 font-sans text-lg font-bold text-on-surface">
                    {item.name}
                  </h3>
                  <p className="mt-2 font-sans text-sm text-on-surface-variant leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                <div className="mt-6 flex flex-col gap-3 border-t border-brand-border pt-4">
                  <div className="flex items-center justify-between font-mono text-xs text-on-surface-variant">
                    <span>Email Demo:</span>
                    <span className="font-semibold text-brand-ink-navy">{item.email}</span>
                  </div>
                  <Link
                    href={`/masuk?email=${encodeURIComponent(item.email)}`}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-ink-navy px-4 font-sans text-sm font-semibold text-brand-cloud-white transition-colors hover:bg-brand-deep-ocean"
                  >
                    <span>Masuk Sebagai {item.name}</span>
                    <span aria-hidden="true">&rarr;</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-10 text-center font-sans text-sm text-on-surface-variant">
            Akun demo saat ini tidak diaktifkan pada lingkungan ini.
          </p>
        )}
      </div>
    </section>
  );
}
