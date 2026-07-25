/**
 * AboutSplitSection — Inspired by BuildPro & Hornet split showcase section.
 * Combines left-hand descriptive highlights + checklist points with right-hand visual status cards.
 */
export function AboutSplitSection() {
  const highlights = [
    { title: "Kamera & GPS Offline PWA", desc: "Mengambil bukti foto & koordinat presisi langsung dari lokasi bencana tanpa memerlukan koneksi seluler." },
    { title: "Deteksi Kerusakan AI (<500ms)", desc: "Algoritma lokal ONNX mengklasifikasikan tingkat kerusakan (hancur, berat, sedang, ringan) secara cepat." },
    { title: "Verifikasi Manusia (Human-in-Loop)", desc: "Mencegah kesalahan keputusan otomatis dengan menempatkan petugas verifikator sebagai pengambil keputusan sah." },
    { title: "Peta Krisis & Penugasan Tim", desc: "Klasterisasi geospasial di Command Center memudahkan alokasi logistik & penugasan tim respons cepat." },
  ];

  return (
    <section className="bg-surface-container-low py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          {/* Left Text & Highlight Checklist Column */}
          <div className="flex flex-col gap-6 lg:col-span-7">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-signal-cyan/40 bg-brand-signal-cyan/10 px-3 py-1 font-mono text-xs font-bold text-brand-signal-cyan">
                KENAPA MBOYO BERBEDA?
              </span>
              <h2 className="mt-3 font-sans text-2xl font-extrabold text-on-surface sm:text-3xl lg:text-4xl">
                Tanggap Bencana yang Cepat, Akurat, dan Dapat Diandalkan Saat Darurat
              </h2>
              <p className="mt-3 font-sans text-base text-on-surface-variant">
                Saat infrastruktur komunikasi lumpuh akibat bencana alam, MBOYO memastikan setiap informasi lapangan tetap tercatat dan tersampaikan secara efisien.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {highlights.map((item) => (
                <div key={item.title} className="flex flex-col gap-1 rounded-xl border border-brand-border bg-surface-container-lowest p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-safe-green text-xs text-white">✓</span>
                    <h3 className="font-sans text-sm font-bold text-on-surface">{item.title}</h3>
                  </div>
                  <p className="pl-7 font-sans text-xs text-on-surface-variant leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Visual Card Stack (Inspired by Hornet & BuildPro) */}
          <div className="lg:col-span-5">
            <div className="relative mx-auto max-w-md rounded-2xl border border-brand-border bg-surface-container-lowest p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-brand-border pb-4">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-brand-ink-navy">#LPR-2026-089</span>
                  <span className="rounded-full bg-brand-caution-amber/20 px-2 py-0.5 font-mono text-[10px] font-bold text-[#7a5109]">
                    Perlu Verifikasi
                  </span>
                </div>
                <span className="font-mono text-xs text-on-surface-variant">Baru Saja Sync</span>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                <div className="flex items-center justify-between rounded-lg bg-surface-container-low p-3">
                  <span className="font-sans text-xs font-semibold text-on-surface">Prediksi AI (ONNX)</span>
                  <span className="font-mono text-xs font-bold text-brand-critical-red">Kerusakan Berat (88%)</span>
                </div>

                <div className="flex items-center justify-between rounded-lg bg-surface-container-low p-3">
                  <span className="font-sans text-xs font-semibold text-on-surface">Lokasi Geospasial</span>
                  <span className="font-mono text-xs font-bold text-brand-ink-navy">Cianjur (-6.82, 107.14)</span>
                </div>

                <div className="rounded-lg border border-brand-border p-3">
                  <span className="font-sans text-xs font-bold text-on-surface">Catatan Verifikator:</span>
                  <p className="mt-1 font-sans text-xs text-on-surface-variant">
                    &ldquo;Foto tampak depan menunjukkan retakan struktur utama. Dikonfirmasi prioritas tinggi untuk tim respons.&rdquo;
                  </p>
                </div>
              </div>

              {/* Floating Stat Badge Overlay */}
              <div className="absolute -bottom-5 -right-5 rounded-xl border border-brand-signal-cyan/40 bg-brand-ink-navy p-3 text-white shadow-xl">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xl font-extrabold text-brand-caution-amber">98.4%</span>
                  <div className="flex flex-col">
                    <span className="font-sans text-[11px] font-bold text-white">Reliabilitas Mode Demo</span>
                    <span className="font-mono text-[9px] text-slate-300">0ms Latency Fallback</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
