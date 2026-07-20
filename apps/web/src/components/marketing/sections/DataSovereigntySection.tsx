import Link from "next/link";

const PRINCIPLES = [
  { title: "Bukti tersimpan privat", body: "Foto laporan disimpan di bucket privat — tidak pernah diakses melalui tautan publik tanpa otorisasi." },
  { title: "Model lokal, bukan pihak ketiga", body: "Klasifikasi utama dijalankan oleh model computer vision yang dijalankan dan dievaluasi sendiri, bukan API eksternal." },
  { title: "AI eksternal bersifat opsional dan hanya saran", body: "Jika diaktifkan, Gemini hanya memberi konteks tambahan bagi Verifikator — tidak pernah menjadi keputusan otomatis." },
  { title: "Retensi data yang dapat dikonfigurasi", body: "Kebijakan retensi bukti mentah ditentukan oleh Administrator Sistem dan terlihat oleh Auditor." },
];

/** "Data sovereignty" section — how MBOYO handles sensitive data and external AI. */
export function DataSovereigntySection() {
  return (
    <section id="keamanan-data" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-sans text-2xl font-bold text-on-surface sm:text-3xl">
          Kedaulatan dan Keamanan Data
        </h2>
        <p className="mt-2 font-sans text-sm text-on-surface-variant">
          Data korban dan lokasi bencana adalah data sensitif — MBOYO dirancang untuk menjaganya
          tetap privat dan dapat diaudit.
        </p>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {PRINCIPLES.map((item) => (
          <div key={item.title} className="rounded-lg border border-brand-border bg-surface-container-lowest p-6">
            <h3 className="font-sans text-base font-semibold text-on-surface">{item.title}</h3>
            <p className="mt-2 font-sans text-sm text-on-surface-variant">{item.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link href="/data-governance" className="font-sans text-sm font-semibold text-brand-signal-cyan hover:underline">
          Baca Tata Kelola Data lengkap &rarr;
        </Link>
        <Link href="/privacy" className="font-sans text-sm font-semibold text-brand-signal-cyan hover:underline">
          Baca Kebijakan Privasi &rarr;
        </Link>
      </div>
    </section>
  );
}
