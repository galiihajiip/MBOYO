const FLOW_STEPS = [
  { step: "01", title: "Foto & Lokasi Diambil", detail: "Pelapor memotret kerusakan dan menandai lokasi di HP-nya, tanpa perlu sinyal seluler sama sekali.", tag: "Offline" },
  { step: "02", title: "Tersimpan Aman di HP", detail: "Laporan langsung tersimpan di perangkat, tidak hilang meski aplikasi tertutup atau HP restart.", tag: "Aman di HP" },
  { step: "03", title: "Terkirim Otomatis", detail: "Begitu sinyal atau Wi-Fi kembali, laporan langsung terkirim sendiri, tanpa risiko terkirim dua kali.", tag: "Auto-Sync" },
  { step: "04", title: "Disaring Cepat oleh AI", detail: "Sistem langsung memberi perkiraan awal tingkat kerusakan dalam hitungan detik setelah foto terkirim.", tag: "Penyaringan AI" },
  { step: "05", title: "Dicek oleh Petugas", detail: "Petugas terlatih meninjau bukti untuk mengonfirmasi, memperbaiki, menolak, atau menaikkan level laporan.", tag: "Verifikator" },
  { step: "06", title: "Tim Bantuan Ditugaskan", detail: "Koordinator melihat laporan terverifikasi di peta, menentukan prioritas, dan mengirim tim ke lokasi.", tag: "Respons Lapangan" },
] as const;

/**
 * "Cara Kerja" section — Dark Navy Brand Gradient section with glowing 3D cards.
 */
export function FlowSection() {
  return (
    <section id="cara-kerja" className="relative overflow-hidden bg-gradient-to-br from-[#06141f] via-[#082032] to-[#0b3a53] py-16 text-white sm:py-24">
      {/* Ambient background glow */}
      <div
        className="pointer-events-none absolute -left-20 top-1/2 h-96 w-96 rounded-full bg-brand-signal-cyan/15 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-signal-cyan/40 bg-brand-signal-cyan/10 px-3.5 py-1 font-mono text-xs font-bold text-brand-signal-cyan">
            DARI FOTO SAMPAI TIM BANTUAN TIBA
          </span>
          <h2 className="mt-3 font-sans text-2xl font-extrabold text-white sm:text-3xl lg:text-4xl">
            Bagaimana MBOYO Bekerja di Lapangan
          </h2>
          <p className="mt-3 font-sans text-base text-slate-300">
            Dari saat foto diambil tanpa sinyal, sampai tim bantuan ditugaskan ke lokasi — setiap langkah bisa
            ditelusuri, tidak ada yang tersembunyi.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FLOW_STEPS.map((item) => (
            <div
              key={item.step}
              className="group relative flex flex-col justify-between rounded-3xl border border-white/15 bg-white/5 p-6 shadow-2xl backdrop-blur-md transition-all duration-300 hover:-translate-y-2 hover:border-brand-signal-cyan/60 hover:bg-white/10"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-signal-cyan/20 border border-brand-signal-cyan/40 font-mono text-sm font-bold text-brand-signal-cyan group-hover:bg-brand-signal-cyan group-hover:text-brand-ink-navy transition-colors">
                    {item.step}
                  </span>
                  <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-slate-300">
                    {item.tag}
                  </span>
                </div>
                <h3 className="mt-4 font-sans text-base font-bold text-white group-hover:text-brand-signal-cyan transition-colors">
                  {item.title}
                </h3>
                <p className="mt-2 font-sans text-xs leading-relaxed text-slate-300">
                  {item.detail}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-3">
                <span className="font-mono text-[10px] text-slate-400">Terverifikasi Audit</span>
                <span aria-hidden="true" className="font-sans text-xs text-brand-signal-cyan font-bold">✓</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
