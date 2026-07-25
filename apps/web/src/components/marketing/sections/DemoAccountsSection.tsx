import Link from "next/link";
import { RoleBadge } from "@mboyo/ui";
import type { Role } from "@mboyo/domain";

const DEMO_ROLES: {
  role: Role;
  name: string;
  email: string;
  desc: string;
  dest: string;
  cardStyle: string;
}[] = [
  {
    role: "reporter",
    name: "Pelapor Warga",
    email: "reporter@mboyo.demo",
    desc: "Buat laporan kerusakan offline, kelola antrean lokal, dan lihat riwayat laporan.",
    dest: "/reporter",
    cardStyle: "border-brand-signal-cyan/40 bg-brand-signal-cyan/10",
  },
  {
    role: "verifier",
    name: "Petugas Verifikator",
    email: "verifier@mboyo.demo",
    desc: "Tinjau bukti foto, hasil analisis AI, dan ambil keputusan verifikasi resmi.",
    dest: "/verifier",
    cardStyle: "border-brand-relief-teal/40 bg-brand-relief-teal/10",
  },
  {
    role: "response_coordinator",
    name: "Koordinator Respons",
    email: "coordinator@mboyo.demo",
    desc: "Kelola Command Center, peta krisis PostGIS, klaster insiden, & penugasan tim.",
    dest: "/command",
    cardStyle: "border-brand-caution-amber/40 bg-brand-caution-amber/10",
  },
  {
    role: "system_administrator",
    name: "Administrator Sistem",
    email: "admin@mboyo.demo",
    desc: "Kelola akun pengguna, penetapan peran, kejadian bencana, & kesehatan sistem.",
    dest: "/admin",
    cardStyle: "border-brand-critical-red/40 bg-brand-critical-red/10",
  },
  {
    role: "auditor",
    name: "Auditor Independen",
    email: "auditor@mboyo.demo",
    desc: "Akses riwayat audit (audit trail), evaluasi model AI, & ekspor kepatuhan data.",
    dest: "/audit",
    cardStyle: "border-slate-400/40 bg-slate-500/10",
  },
];

/**
 * "Demo accounts" section — Dark Navy Brand Gradient section with 3D glassmorphic cards.
 */
export function DemoAccountsSection() {
  const demoMode =
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  return (
    <section id="akun-demo" className="relative overflow-hidden bg-gradient-to-b from-[#06141f] via-[#082032] to-[#0b3a53] py-16 text-white sm:py-24">
      {/* Background Glow */}
      <div
        className="pointer-events-none absolute -right-20 top-1/4 h-96 w-96 rounded-full bg-brand-caution-amber/15 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-caution-amber/60 bg-brand-caution-amber/20 px-3.5 py-1 font-mono text-xs font-bold text-brand-caution-amber">
            AKSES DEMO INSTAN
          </span>
          <h2 className="mt-3 font-sans text-2xl font-extrabold text-white sm:text-3xl lg:text-4xl">
            Coba MBOYO Sesuai Peran Anda
          </h2>
          <p className="mt-3 font-sans text-base text-slate-300">
            Uji seluruh fitur platform dari 5 perspektif peran yang berbeda secara langsung.
          </p>
        </div>

        {demoMode ? (
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {DEMO_ROLES.map((item) => (
              <div
                key={item.email}
                className={`flex flex-col justify-between rounded-3xl border p-6 shadow-2xl backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 hover:shadow-cyan-950/50 ${item.cardStyle}`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <RoleBadge role={item.role} />
                    <span className="font-mono text-[10px] font-bold text-slate-300">
                      Demo Mode
                    </span>
                  </div>
                  <h3 className="mt-4 font-sans text-lg font-bold text-white">
                    {item.name}
                  </h3>
                  <p className="mt-2 font-sans text-xs text-slate-300 leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between font-mono text-xs text-slate-300">
                    <span>Email Demo:</span>
                    <span className="font-semibold text-brand-signal-cyan">{item.email}</span>
                  </div>
                  <Link
                    href={`/masuk?email=${encodeURIComponent(item.email)}`}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-caution-amber px-4 font-sans text-sm font-bold text-brand-ink-navy shadow-md transition-all hover:bg-amber-400"
                  >
                    <span>Masuk Sebagai {item.name}</span>
                    <span aria-hidden="true">&rarr;</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-10 text-center font-sans text-sm text-slate-300">
            Akun demo saat ini tidak diaktifkan pada lingkungan ini.
          </p>
        )}
      </div>
    </section>
  );
}
