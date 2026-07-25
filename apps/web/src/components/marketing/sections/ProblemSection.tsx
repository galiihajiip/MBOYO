const PROBLEMS = [
  {
    title: "1. Konektivitas Terputus Saat Darurat",
    body: "Bencana merusak jaringan seluler lebih dulu: aplikasi pelaporan konvensional yang wajib koneksi langsung gagal di momen paling kritis.",
    icon: (
      <svg className="h-6 w-6 text-brand-critical-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 4.243a9 9 0 010-12.728m0 0l2.829 2.829M1 1l22 22" />
      </svg>
    ),
    badge: "Masalah Jaringan",
  },
  {
    title: "2. Triase Manual Terhambat Volume Laporan",
    body: "Tanpa computer vision lokal, tim verifikator kewalahan menyaring ribuan laporan masuk. Laporan kritis berisiko tertunda lama.",
    icon: (
      <svg className="h-6 w-6 text-brand-caution-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    badge: "Bottleneck Verifikasi",
  },
  {
    title: "3. Keputusan AI Murni Tanpa Akuntabilitas",
    body: "Klasifikasi AI tanpa verifikasi manusia berisiko salah menilai kerusakan bangunan: MBOYO menempatkan manusia sebagai pengambil keputusan akhir.",
    icon: (
      <svg className="h-6 w-6 text-brand-priority-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    badge: "Risiko AI Otomatis",
  },
];

/** Redesigned ProblemSection — Dark Navy Brand Gradient section with 3D glassmorphic cards. */
export function ProblemSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#06141f] via-[#082032] to-[#0b3a53] py-16 text-white sm:py-24">
      {/* Background Decorative Blur */}
      <div
        className="pointer-events-none absolute -right-20 top-1/3 h-96 w-96 rounded-full bg-brand-critical-red/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-critical-red/40 bg-brand-critical-red/10 px-3.5 py-1 font-mono text-xs font-bold text-brand-critical-red">
            TANTANGAN LAPANGAN
          </span>
          <h2 className="mt-3 font-sans text-2xl font-extrabold text-white sm:text-3xl lg:text-4xl">
            Sistem Pelaporan Lama Belum Siap untuk Bencana Nyata
          </h2>
          <p className="mt-3 font-sans text-base text-slate-300">
            Infrastruktur komunikasi sering lumpuh saat bencana terjadi. MBOYO hadir menyelesaikan tiga masalah mendasar ini.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {PROBLEMS.map((item) => (
            <div
              key={item.title}
              className="group relative flex flex-col justify-between rounded-3xl border border-white/15 bg-white/5 p-6 shadow-2xl backdrop-blur-md transition-all duration-300 hover:-translate-y-2 hover:border-brand-signal-cyan/60 hover:bg-white/10"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-ink-navy/80 border border-white/20 shadow-inner group-hover:scale-110 transition-transform">
                    {item.icon}
                  </div>
                  <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 font-mono text-[10px] font-bold text-slate-300">
                    {item.badge}
                  </span>
                </div>

                <h3 className="mt-5 font-sans text-lg font-bold text-white group-hover:text-brand-signal-cyan transition-colors">
                  {item.title}
                </h3>
                <p className="mt-2.5 font-sans text-xs leading-relaxed text-slate-300">
                  {item.body}
                </p>
              </div>

              <div className="mt-6 flex items-center gap-1.5 border-t border-white/10 pt-4 font-mono text-xs font-bold text-brand-signal-cyan">
                <span>Diperbaiki oleh MBOYO</span>
                <span aria-hidden="true">&rarr;</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
