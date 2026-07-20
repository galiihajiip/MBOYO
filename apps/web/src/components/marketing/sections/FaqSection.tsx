const FAQ_ITEMS = [
  {
    question: "Apakah laporan bisa hilang jika saya sedang offline?",
    answer:
      "Tidak. Laporan disimpan di perangkat Anda begitu dibuat, dan hanya menunggu koneksi untuk disinkronkan — proses ini otomatis dan tidak memerlukan aksi tambahan dari Anda.",
  },
  {
    question: "Apakah keputusan tingkat kerusakan dibuat oleh AI sepenuhnya?",
    answer:
      "Tidak. Model computer vision hanya memberikan sinyal awal (probabilitas dan skor kualitas). Keputusan akhir — konfirmasi, koreksi, penolakan, atau eskalasi — selalu dilakukan oleh Verifikator manusia.",
  },
  {
    question: "Siapa yang dapat melihat foto dan lokasi laporan saya?",
    answer:
      "Hanya Verifikator, Koordinator Respons (untuk laporan yang sudah terverifikasi), dan Auditor (untuk keperluan audit) yang memiliki akses — diatur oleh kebijakan akses berbasis peran di tingkat basis data.",
  },
  {
    question: "Apakah MBOYO menggunakan AI pihak ketiga seperti Gemini?",
    answer:
      "Integrasi tersebut bersifat opsional, dinonaktifkan secara default, dan jika diaktifkan hanya memberikan referensi tambahan — tidak pernah menggantikan keputusan Verifikator.",
  },
  {
    question: "Bagaimana jika saya menemukan bug atau ingin memberi masukan?",
    answer:
      "Hubungi tim melalui kontak yang tercantum pada halaman Metodologi — kami mencatat setiap masukan sebagai bagian dari proses evaluasi berkelanjutan.",
  },
] as const;

/** "FAQ" section, using native <details>/<summary> for accessible disclosure without JS. */
export function FaqSection() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-10">
      <h2 className="text-center font-sans text-2xl font-bold text-on-surface sm:text-3xl">
        Pertanyaan yang Sering Diajukan
      </h2>

      <div className="mt-10 flex flex-col gap-3">
        {FAQ_ITEMS.map((item) => (
          <details
            key={item.question}
            className="group rounded-lg border border-brand-border bg-surface-container-lowest p-4"
          >
            <summary className="flex min-h-11 cursor-pointer items-center justify-between font-sans text-base font-semibold text-on-surface">
              {item.question}
              <span aria-hidden="true" className="text-on-surface-variant group-open:rotate-180">
                &darr;
              </span>
            </summary>
            <p className="mt-2 font-sans text-sm text-on-surface-variant">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
