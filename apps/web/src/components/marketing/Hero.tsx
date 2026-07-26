import Link from "next/link";

/**
 * Enhanced Hero section — clean, modern dark navy banner with SVG icons (zero emojis).
 * Uses font-sans (Plus Jakarta Sans) for headings/body and font-mono (IBM Plex Mono) for metrics/labels.
 */
export function Hero() {
  const stats = [
    { value: "0", label: "Butuh Sinyal", detail: "Foto & lokasi tersimpan di HP dulu", color: "text-brand-caution-amber" },
    { value: "<1 detik", label: "Cek Kerusakan Otomatis", detail: "AI langsung menilai dari foto", color: "text-brand-signal-cyan" },
    { value: "1", label: "Peta Terpusat", detail: "Semua laporan terlihat di satu tempat", color: "text-brand-safe-green" },
    { value: "100%", label: "Dicek Petugas", detail: "Keputusan akhir tetap dari manusia", color: "text-brand-priority-orange" },
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#06141f] via-[#082032] to-[#0b3a53] pb-16 pt-12 text-brand-cloud-white sm:pb-24 sm:pt-16 lg:pb-32 lg:pt-20">
      {/* Background Decorative Glow Effects */}
      <div
        className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-brand-signal-cyan/15 blur-[120px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-40 top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-brand-caution-amber/10 blur-[140px]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-8">
          {/* Hero Left Content Column */}
          <div className="flex flex-col gap-6 lg:col-span-7">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-signal-cyan/40 bg-brand-signal-cyan/10 px-4 py-1.5 font-mono text-xs font-semibold tracking-wide text-brand-signal-cyan shadow-sm backdrop-blur">
                <svg className="h-3.5 w-3.5 text-brand-signal-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                DIBUAT UNTUK SAAT SINYAL HP MATI TOTAL
              </span>
            </div>

            <h1 className="font-sans text-3xl font-extrabold leading-tight text-brand-cloud-white sm:text-4xl lg:text-[46px] lg:leading-[56px]">
              Sinyal Putus, Laporan Bencana <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-brand-signal-cyan via-emerald-300 to-brand-caution-amber bg-clip-text text-transparent">
                Tetap Sampai.
              </span>
            </h1>

            <p className="font-sans text-base leading-relaxed text-slate-300 sm:text-lg">
              Saat bencana terjadi, jaringan seluler biasanya ikut rusak duluan, jadi aplikasi lapor yang
              wajib internet malah gagal di saat paling dibutuhkan. Dengan MBOYO, warga tetap bisa{" "}
              <strong className="text-white">memotret kerusakan dan menandai lokasi tanpa sinyal sama sekali</strong>.
              Laporan tersimpan aman di HP, lalu terkirim otomatis begitu jaringan kembali menyala,
              langsung disaring cepat oleh AI, dan tetap dicek ulang oleh petugas sebelum tim bantuan bergerak.
            </p>

            <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center">
              <Link
                href="/masuk?next=%2Freporter%2Flaporan%2Fbaru"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand-caution-amber px-6 font-sans text-base font-bold text-brand-ink-navy shadow-lg shadow-brand-caution-amber/20 transition-all hover:bg-amber-400 hover:shadow-amber-400/30"
              >
                <span>Buat Laporan Sekarang</span>
                <span aria-hidden="true">&rarr;</span>
              </Link>
              <a
                href="#akun-demo"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-6 font-sans text-base font-semibold text-white backdrop-blur transition-all hover:bg-white/10"
              >
                <span>Coba Demo Command Center</span>
              </a>
            </div>

            <div className="flex items-center gap-4 pt-2">
              <div className="flex -space-x-2 overflow-hidden">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-signal-cyan font-mono text-xs font-bold text-brand-ink-navy ring-2 ring-brand-ink-navy">W</span>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-relief-teal font-mono text-xs font-bold text-white ring-2 ring-brand-ink-navy">V</span>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-caution-amber font-mono text-xs font-bold text-brand-ink-navy ring-2 ring-brand-ink-navy">K</span>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-priority-orange font-mono text-xs font-bold text-white ring-2 ring-brand-ink-navy">A</span>
              </div>
              <span className="font-sans text-xs text-slate-300">
                <strong className="text-white">5 Peran, Akses Terpisah:</strong> Pelapor, Verifikator, Koordinator, Admin, & Auditor tidak bisa saling intip data satu sama lain
              </span>
            </div>
          </div>

          {/* Hero Right Visual Column */}
          <div className="lg:col-span-5">
            <HeroPipelineDiagram />
          </div>
        </div>

        {/* Docked Floating Quick Stat Counter Bar */}
        <div className="mt-16 rounded-xl border border-white/15 bg-white/5 p-4 backdrop-blur-md shadow-2xl sm:mt-20 sm:p-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col gap-1 border-r border-white/10 px-2 last:border-0 sm:px-4">
                <span className={`font-mono text-2xl font-extrabold sm:text-3xl ${stat.color}`}>
                  {stat.value}
                </span>
                <span className="font-sans text-sm font-semibold text-white">
                  {stat.label}
                </span>
                <span className="font-sans text-xs text-slate-400">
                  {stat.detail}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroPipelineDiagram() {
  const steps = [
    { label: "Foto & Lokasi Tanpa Internet", desc: "Langsung tersimpan aman di HP pelapor", tag: "Offline", color: "bg-slate-700 text-slate-200" },
    { label: "Terkirim Otomatis", desc: "Begitu sinyal kembali, tanpa laporan ganda", tag: "Auto Sync", color: "bg-brand-signal-cyan/20 text-brand-signal-cyan border border-brand-signal-cyan/40" },
    { label: "Dicek Cepat oleh AI", desc: "Perkiraan awal tingkat kerusakan & foto valid", tag: "<1 detik", color: "bg-brand-caution-amber/20 text-brand-caution-amber border border-brand-caution-amber/40" },
    { label: "Dikonfirmasi Petugas", desc: "Manusia yang memutuskan, bukan AI", tag: "Dicek Manusia", color: "bg-brand-relief-teal/20 text-teal-300 border border-brand-relief-teal/40" },
    { label: "Tim Bantuan Bergerak", desc: "Terlihat di peta, langsung ditugaskan ke lokasi", tag: "Langsung", color: "bg-brand-safe-green/20 text-emerald-300 border border-brand-safe-green/40" },
  ];

  return (
    <div
      role="img"
      aria-label="Diagram alur sistem MBOYO dari offline hingga command center"
      className="flex flex-col gap-3.5 rounded-2xl border border-white/15 bg-brand-night/80 p-6 shadow-2xl backdrop-blur-md"
    >
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-brand-critical-red" />
          <span className="h-3 w-3 rounded-full bg-brand-caution-amber" />
          <span className="h-3 w-3 rounded-full bg-brand-safe-green" />
        </div>
        <span className="font-mono text-xs font-medium text-slate-400">
          Perjalanan Satu Laporan
        </span>
      </div>

      <div className="flex flex-col gap-2.5 pt-1">
        {steps.map((step, index) => (
          <div
            key={step.label}
            className="group flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3 transition-all hover:border-brand-signal-cyan/50 hover:bg-white/10"
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-ink-navy font-mono text-xs font-bold text-brand-signal-cyan border border-brand-signal-cyan/30"
              >
                0{index + 1}
              </span>
              <div className="flex flex-col">
                <span className="font-sans text-xs font-bold text-white group-hover:text-brand-signal-cyan">
                  {step.label}
                </span>
                <span className="font-sans text-[11px] text-slate-400">
                  {step.desc}
                </span>
              </div>
            </div>
            <span className={`shrink-0 rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold ${step.color}`}>
              {step.tag}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
