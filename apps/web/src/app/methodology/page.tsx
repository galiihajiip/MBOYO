import type { Metadata } from "next";
import { TrustPageLayout } from "../../components/marketing/TrustPageLayout";

export const metadata: Metadata = {
  title: "Metodologi — MBOYO",
  description: "Bagaimana MBOYO mengevaluasi model dan mengukur keberhasilan platform.",
  alternates: { canonical: "/methodology" },
};

export default function MethodologyPage() {
  return (
    <TrustPageLayout title="Metodologi" lastUpdated="16 Juli 2026">
      <p>
        Halaman ini menjelaskan bagaimana MBOYO mengevaluasi model computer vision dan mengukur
        keberhasilan platform secara keseluruhan — termasuk komitmen kami untuk tidak
        mempublikasikan klaim yang belum diukur.
      </p>

      <h2>Prinsip Kejujuran Evaluasi</h2>
      <ul>
        <li>Akurasi model tidak pernah dijelaskan sebagai terjamin.</li>
        <li>
          Setiap metrik yang dilaporkan diukur pada set data uji yang belum pernah dilihat model
          selama pelatihan, dan ditandai dengan tanggal evaluasi.
        </li>
        <li>Tidak ada angka placeholder atau contoh yang dipilih secara selektif untuk terlihat lebih baik dari performa sebenarnya.</li>
      </ul>

      <h2>Metrik yang Kami Ukur</h2>
      <ul>
        <li><strong>Macro-F1</strong> — rata-rata F1 tanpa pembobotan di seluruh kelas tingkat keparahan, agar kelas langka namun berisiko tinggi tidak terabaikan.</li>
        <li><strong>Recall Kelas &quot;Hancur Total&quot;</strong> — dilacak terpisah karena false negative pada kelas ini memiliki biaya nyata tertinggi.</li>
        <li><strong>Galat Kalibrasi</strong> — mengukur apakah tingkat keyakinan model sesuai dengan akurasi empirisnya.</li>
        <li><strong>Tingkat Abstain</strong> — persentase input yang di bawah ambang keyakinan sehingga diarahkan ke tinjauan manual penuh.</li>
      </ul>

      <h2>Gerbang Rilis Model</h2>
      <p>
        Sebuah model kandidat hanya dipromosikan menjadi model yang melayani permintaan produksi
        jika memenuhi seluruh ambang batas macro-F1, recall kelas &quot;hancur total&quot;, dan
        galat kalibrasi yang telah ditetapkan — dengan laporan evaluasi yang tercatat lengkap
        (identitas dataset, tanggal, versi model). Jika kandidat belum memenuhi gerbang ini,
        sistem menampilkan hasilnya sebagai <strong>saran (advisory-only)</strong>, bukan
        keputusan, dan Verifikator tetap melakukan tinjauan manual penuh.
      </p>

      <h2>Reliabilitas Demo</h2>
      <p>
        Kami melacak persentase sesi demo langsung yang berhasil diselesaikan tanpa intervensi
        manual atau penggunaan mode demo — metrik ini membantu kami memahami risiko presentasi
        secara jujur, bukan mengasumsikan semuanya berjalan sempurna.
      </p>

      <h2>Kontak</h2>
      <p>
        Untuk pertanyaan metodologi atau permintaan laporan evaluasi lengkap, hubungi tim melalui
        kanal komunikasi resmi PIDI Digdaya × Hackathon Bank Indonesia 2026.
      </p>
    </TrustPageLayout>
  );
}
