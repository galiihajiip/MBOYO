const FLOW_STEPS = [
  { step: "01", title: "Ambil Foto & GPS Offline", detail: "Pelapor mengambil foto kerusakan & lokasi GPS di perangkat tanpa koneksi seluler.", tag: "Offline" },
  { step: "02", title: "Penyimpanan Lokal Aman", detail: "Laporan tersimpan di Dexie IndexedDB perangkat, aman dari kegagalan aplikasi.", tag: "IndexedDB" },
  { step: "03", title: "Sinkronisasi Otomatis", detail: "Dikirim idempoten begitu sinyal seluler atau Wi-Fi terhubung kembali.", tag: "Auto-Sync" },
  { step: "04", title: "Triase Vision AI Lokal", detail: "Model ONNX menganalisis foto untuk memprediksi tingkat kerusakan awal (<500ms).", tag: "AI Triage" },
  { step: "05", title: "Verifikasi Berbasis Manusia", detail: "Petugas meninjau bukti untuk mengonfirmasi, merevisi, menolak, atau mengeskalasi.", tag: "Verifikator" },
  { step: "06", title: "Koordinasi Respons Geospasial", detail: "Koordinator memprioritaskan insiden di Peta Krisis & menugaskan tim lapangan.", tag: "Command Center" },
] as const;

/**
 * "Cara Kerja" section — zero em-dashes (—).
 */
export function FlowSection() {
  return (
    <section id="cara-kerja" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-border bg-surface-container-low px-3 py-1 font-mono text-xs font-bold text-on-surface-variant">
          ALUR SISTEM TERINTEGRASI
        </span>
        <h2 className="mt-3 font-sans text-2xl font-extrabold text-on-surface sm:text-3xl lg:text-4xl">
          Bagaimana MBOYO Bekerja di Lapangan
        </h2>
        <p className="mt-3 font-sans text-base text-on-surface-variant">
          Dari pengambilan foto offline hingga alokasi tim respons: satu alur transparan yang dapat ditelusuri sepenuhnya.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FLOW_STEPS.map((item) => (
          <div
            key={item.step}
            className="group relative flex flex-col justify-between rounded-2xl border border-brand-border bg-surface-container-lowest p-6 shadow-sm transition-all hover:border-brand-signal-cyan/50 hover:shadow-lg"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-ink-navy font-mono text-sm font-bold text-brand-cloud-white group-hover:bg-brand-signal-cyan group-hover:text-brand-ink-navy transition-colors">
                  {item.step}
                </span>
                <span className="rounded-full bg-surface-container-low px-2.5 py-0.5 font-mono text-[10px] font-bold text-on-surface-variant">
                  {item.tag}
                </span>
              </div>
              <h3 className="mt-4 font-sans text-base font-bold text-on-surface group-hover:text-brand-ink-navy">
                {item.title}
              </h3>
              <p className="mt-2 font-sans text-sm text-on-surface-variant leading-relaxed">
                {item.detail}
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-brand-border pt-3">
              <span className="font-mono text-[10px] text-on-surface-variant">Terverifikasi Audit</span>
              <span aria-hidden="true" className="font-sans text-xs text-brand-signal-cyan font-bold">✓</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
