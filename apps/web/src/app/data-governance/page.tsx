import type { Metadata } from "next";
import { TrustPageLayout } from "../../components/marketing/TrustPageLayout";

export const metadata: Metadata = {
  title: "Tata Kelola Data — MBOYO",
  description: "Bagaimana MBOYO mengatur akses, retensi, dan penggunaan AI eksternal atas data laporan bencana.",
  alternates: { canonical: "/data-governance" },
};

export default function DataGovernancePage() {
  return (
    <TrustPageLayout title="Tata Kelola Data" lastUpdated="16 Juli 2026">
      <p>
        Data laporan bencana — foto korban, lokasi kejadian, dan detail terkait — adalah data
        sensitif. Halaman ini menjelaskan bagaimana MBOYO mengatur akses, retensi, dan potensi
        penggunaan layanan AI eksternal.
      </p>

      <h2>Penyimpanan Bukti</h2>
      <p>
        Foto bukti disimpan pada bucket privat yang terpisah dari data ekspor. Tidak ada bucket
        yang dikonfigurasi publik. Akses hanya melalui URL bertanda tangan (signed URL) berumur
        pendek yang diterbitkan setelah pemeriksaan otorisasi berbasis peran.
      </p>

      <h2>Retensi dan Pengarsipan</h2>
      <p>
        Kebijakan retensi bukti mentah dikonfigurasi oleh Administrator Sistem dan diterapkan
        melalui proses terjadwal, bukan penghapusan manual ad hoc. Status arsip setiap laporan
        terlihat oleh Auditor melalui jejak audit yang tidak dapat diubah.
      </p>

      <h2>Jejak Audit yang Tidak Dapat Diubah</h2>
      <p>
        Setiap transisi status penting — laporan dibuat, dianalisis, diverifikasi, ditugaskan —
        dicatat sebagai peristiwa audit yang bersifat tambah-saja (append-only). Tidak ada peran,
        termasuk Administrator Sistem, yang memiliki wewenang mengubah atau menghapus riwayat
        audit.
      </p>

      <h2>Penggunaan AI Eksternal (Opsional)</h2>
      <p>
        Integrasi AI eksternal (misalnya Gemini) bersifat opt-in eksplisit, nonaktif secara
        default, dan hanya dipanggil dari sisi server. Jika diaktifkan, keluarannya selalu
        ditampilkan sebagai saran tambahan bagi Verifikator dengan label yang jelas — tidak
        pernah menggantikan atau memblokir keputusan Verifikator, dan data sensitif tidak dikirim
        ke layanan tersebut tanpa tinjauan penanganan data secara eksplisit.
      </p>

      <h2>Ekspor Data</h2>
      <p>
        Ekspor operasional (CSV/GeoJSON) yang dibuat oleh Koordinator Respons tidak menyertakan
        bukti mentah atau data pribadi pelapor yang tidak diperlukan secara operasional.
      </p>
    </TrustPageLayout>
  );
}
