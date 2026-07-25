import Link from "next/link";

const ROLES_3D = [
  {
    role: "Pelapor (Reporter)",
    badge: "Public / Citizen",
    badgeColor: "border-brand-signal-cyan/40 bg-brand-signal-cyan/10 text-brand-signal-cyan",
    accentColor: "from-brand-signal-cyan via-teal-400 to-emerald-400",
    desc: "Merekam laporan insiden & bukti foto secara offline. Tidak dapat melihat data pelapor lain.",
    scope: "Hanya Laporan Sendiri",
  },
  {
    role: "Verifikator (Verifier)",
    badge: "Official Field Staff",
    badgeColor: "border-brand-relief-teal/40 bg-brand-relief-teal/10 text-brand-relief-teal",
    accentColor: "from-brand-relief-teal via-cyan-500 to-blue-500",
    desc: "Meninjau laporan mentah, memvalidasi sinyal AI, dan mengonfirmasi tingkat kerusakan.",
    scope: "Antrean Verifikasi Wilayah",
  },
  {
    role: "Koordinator Respons",
    badge: "Command Center Ops",
    badgeColor: "border-brand-priority-orange/40 bg-brand-priority-orange/10 text-brand-priority-orange",
    accentColor: "from-brand-priority-orange via-amber-500 to-yellow-500",
    desc: "Mengelola Peta Krisis Geospasial, mengelompokkan insiden PostGIS, dan menugaskan tim lapangan.",
    scope: "Command Center Geospasial",
  },
  {
    role: "Administrator Sistem",
    badge: "System Admin",
    badgeColor: "border-brand-critical-red/40 bg-brand-critical-red/10 text-brand-critical-red",
    accentColor: "from-brand-critical-red via-rose-500 to-pink-500",
    desc: "Mengonfigurasi ambang batas AI, kebijakan retensi bukti mentah, dan manajemen pengguna.",
    scope: "Manajemen Platform & Config",
  },
  {
    role: "Auditor Independen",
    badge: "Independent Auditor",
    badgeColor: "border-brand-slate/40 bg-brand-slate/10 text-brand-slate",
    accentColor: "from-slate-400 via-slate-500 to-slate-600",
    desc: "Mengakses jejak audit yang tidak dapat diubah (append-only) untuk transparansi publik.",
    scope: "Akses Read-Only Audit Trail",
  },
];

/**
 * 3D Role Separation Architecture Showcase — Zero em-dashes (—).
 */
export function RoleSeparationSection() {
  return (
    <section className="bg-surface-container-low/50 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-signal-cyan/40 bg-brand-signal-cyan/10 px-3.5 py-1 font-mono text-xs font-bold text-brand-signal-cyan">
            ARSITEKTUR HAK AKSES RLS
          </span>
          <h2 className="mt-3 font-sans text-2xl font-extrabold text-on-surface sm:text-3xl lg:text-4xl">
            5 Peran Terpisah: Diatur Ketat oleh Row Level Security (RLS)
          </h2>
          <p className="mt-3 font-sans text-base text-on-surface-variant">
            Setiap peran memiliki batasan otorisasi yang dijamin langsung oleh database Supabase PostGIS, mencegah kebocoran data sensitif antar pengguna.
          </p>
        </div>

        {/* 3D Role Architecture Grid Showcase */}
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES_3D.map((item, idx) => (
            <div
              key={item.role}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-brand-border/80 bg-surface-container-lowest p-6 shadow-md transition-all duration-300 hover:-translate-y-1.5 hover:border-brand-signal-cyan/50 hover:shadow-2xl ${
                idx === 4 ? "sm:col-span-2 lg:col-span-1" : ""
              }`}
            >
              {/* Gradient Accent Top Bar */}
              <div
                className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${item.accentColor}`}
              />

              <div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className={`inline-flex rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-400">RLS Active</span>
                </div>

                <h3 className="mt-4 font-sans text-lg font-extrabold text-on-surface group-hover:text-brand-signal-cyan transition-colors">
                  {item.role}
                </h3>

                <p className="mt-2.5 font-sans text-xs leading-relaxed text-on-surface-variant">
                  {item.detail || item.desc}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-brand-border/60 pt-3">
                <span className="font-mono text-[10px] font-semibold text-slate-400">Scope Otorisasi:</span>
                <span className="font-mono text-[11px] font-bold text-on-surface">{item.scope}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center font-sans text-xs text-on-surface-variant">
          Pelajari lebih detail mengenai skema RLS di{" "}
          <Link href="/docs" className="font-bold text-brand-signal-cyan hover:underline">
            Dokumentasi Navigasi Peran &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}
