const CONTEXT_STATS = [
  {
    value: "5.400+",
    label: "Kejadian Bencana per Tahun",
    detail: "BNPB mencatat lebih dari 5.400 bencana di Indonesia sepanjang 2023 saja.",
  },
  {
    value: "Rp 20–50 T",
    label: "Kerugian Bencana per Tahun",
    detail: "Perkiraan kerugian ekonomi tahunan akibat bencana di Indonesia (Kementerian Keuangan, mengutip data BNPB 2020–2022).",
  },
  {
    value: "79,5%",
    label: "Warga Sudah Terhubung Internet",
    detail: "Penetrasi internet Indonesia menurut APJII (2024) — dasar kenapa aplikasi berbasis HP masuk akal untuk pelaporan bencana.",
  },
  {
    value: "300 ribu+",
    label: "Warga Ikut Lapor Lewat Peta Bersama",
    detail: "Jumlah warga Jakarta yang memakai PetaBencana.id saat banjir besar Februari 2017 — bukti warga mau ikut melapor kalau caranya mudah.",
  },
];

/**
 * Real, independently-sourced context (BNPB, Kemenkeu, APJII, World Bank/
 * GFDRR, PetaBencana.id) about the SCALE of the problem and the general
 * economic case for faster disaster response — never MBOYO's own claimed
 * results, since MBOYO has not yet been measured at scale (that honesty
 * commitment lives in TechAndMetricsHub right below this section). Every
 * figure keeps its source/year inline so it reads as "here's why this
 * problem matters," not "here's what MBOYO achieved."
 */
export function ImpactContextSection() {
  return (
    <section className="bg-surface-container-low/70 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-priority-orange/40 bg-brand-priority-orange/10 px-3.5 py-1 font-mono text-xs font-bold text-brand-priority-orange">
            SEBERAPA BESAR MASALAH INI
          </span>
          <h2 className="mt-3 font-sans text-2xl font-extrabold text-on-surface sm:text-3xl lg:text-4xl">
            Kenapa Kecepatan Melapor Itu Penting
          </h2>
          <p className="mt-3 font-sans text-base text-on-surface-variant">
            Angka-angka di bawah ini adalah data publik tentang skala bencana di Indonesia dan potensi manfaat
            respons yang lebih cepat secara umum — bukan hasil yang sudah dicapai MBOYO. Metrik MBOYO sendiri
            ada di bagian &quot;Transparansi Evaluasi&quot; di bawah.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CONTEXT_STATS.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col gap-2 rounded-2xl border border-brand-border bg-surface-container-lowest p-5 shadow-sm"
            >
              <span className="font-mono text-2xl font-extrabold text-brand-ink-navy">{stat.value}</span>
              <span className="font-sans text-sm font-bold text-on-surface">{stat.label}</span>
              <span className="font-sans text-xs leading-relaxed text-on-surface-variant">{stat.detail}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-brand-safe-green/30 bg-brand-safe-green/5 p-5 sm:p-6">
          <p className="font-sans text-sm leading-relaxed text-on-surface">
            <strong className="text-on-surface">Kenapa respons cepat bernilai secara ekonomi:</strong> menurut
            laporan Lifelines dari World Bank &amp; GFDRR (2019), setiap Rp 1 yang dihabiskan untuk membangun
            infrastruktur yang tahan bencana bisa menghemat sekitar Rp 4 dari biaya pemulihan setelah bencana
            terjadi. UNDRR juga mencatat bahwa peringatan dini 24 jam sebelum bencana dapat memangkas kerugian
            hingga sekitar 30%. MBOYO dibangun dengan logika yang sama: semakin cepat laporan sampai ke tim
            yang tepat, semakin kecil potensi kerugian yang harus ditanggung.
          </p>
        </div>
      </div>
    </section>
  );
}
