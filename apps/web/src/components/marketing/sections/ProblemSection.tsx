const PROBLEMS = [
  {
    title: "1. Konektivitas Terputus Saat Darurat",
    body: "Bencana merusak jaringan seluler lebih dulu — aplikasi pelaporan konvensional yang wajib koneksi langsung gagal di momen paling kritis.",
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
    body: "Klasifikasi AI tanpa verifikasi manusia berisiko salah menilai kerusakan bangunan — MBOYO menempatkan manusia sebagai pengambil keputusan akhir.",
    icon: (
      <svg className="h-6 w-6 text-brand-priority-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    badge: "Risiko AI Otomatis",
  },
];

/** Redesigned ProblemSection (Gambar 1) — 3D cards, SVG icons, and a high-impact layout. */
export function ProblemSection() {
  return (
    <section className="bg-surface-container-low/60 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-critical-red/30 bg-brand-critical-red/10 px-3.5 py-1 font-mono text-xs font-bold text-brand-critical-red">
            TANTANGAN LAPANGAN
          </span>
          <h2 className="mt-3 font-sans text-2xl font-extrabold text-on-surface sm:text-3xl lg:text-4xl">
            Sistem Pelaporan Lama Belum Siap untuk Bencana Nyata
          </h2>
          <p className="mt-3 font-sans text-base text-on-surface-variant">
            Infrastruktur komunikasi sering lumpuh saat bencana terjadi. MBOYO hadir menyelesaikan tiga masalah mendasar ini.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {PROBLEMS.map((item) => (
            <div
              key={item.title}
              className="group relative flex flex-col justify-between rounded-2xl border border-brand-border bg-surface-container-lowest p-6 shadow-[0_10px_25px_rgba(8,32,50,0.06)] transition-all duration-300 hover:-translate-y-2 hover:border-brand-signal-cyan/50 hover:shadow-[0_20px_40px_rgba(8,32,50,0.12)]"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container-low shadow-inner border border-brand-border group-hover:scale-110 transition-transform">
                    {item.icon}
                  </div>
                  <span className="rounded-full bg-surface-container-low px-2.5 py-1 font-mono text-[10px] font-bold text-on-surface-variant">
                    {item.badge}
                  </span>
                </div>

                <h3 className="mt-5 font-sans text-lg font-bold text-on-surface group-hover:text-brand-ink-navy">
                  {item.title}
                </h3>
                <p className="mt-2 font-sans text-sm leading-relaxed text-on-surface-variant">
                  {item.body}
                </p>
              </div>

              <div className="mt-6 flex items-center gap-1.5 border-t border-brand-border/60 pt-4 font-mono text-xs font-bold text-brand-critical-red">
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
