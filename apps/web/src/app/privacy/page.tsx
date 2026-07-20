import type { Metadata } from "next";
import { TrustPageLayout } from "../../components/marketing/TrustPageLayout";

export const metadata: Metadata = {
  title: "Kebijakan Privasi — MBOYO",
  description: "Bagaimana MBOYO mengumpulkan, menyimpan, dan melindungi data laporan bencana.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <TrustPageLayout title="Kebijakan Privasi" lastUpdated="16 Juli 2026">
      <p>
        MBOYO mengumpulkan data yang diperlukan untuk memproses laporan bencana: foto bukti,
        lokasi GPS, deskripsi kejadian, dan identitas dasar pelapor (nama tampilan, nomor
        telepon). Data ini digunakan semata-mata untuk verifikasi, koordinasi respons, dan
        pelaporan kepatuhan.
      </p>

      <h2>Data yang Kami Kumpulkan</h2>
      <ul>
        <li>Foto dan metadata bukti (jenis file, ukuran, hash integritas).</li>
        <li>Koordinat lokasi dan tingkat akurasi GPS pada saat laporan dibuat.</li>
        <li>Nama tampilan dan nomor telepon yang Anda daftarkan.</li>
        <li>Riwayat keputusan verifikasi dan status tugas respons terkait laporan Anda.</li>
      </ul>

      <h2>Bagaimana Data Diakses</h2>
      <p>
        Akses ke bukti dan lokasi laporan diatur oleh kebijakan akses berbasis peran (Row-Level
        Security) di tingkat basis data — bukan sekadar pembatasan tampilan pada antarmuka. Foto
        bukti disimpan pada bucket privat dan tidak pernah diakses melalui tautan publik; setiap
        akses memerlukan URL bertanda tangan (signed URL) yang berlaku singkat dan diterbitkan
        hanya oleh server setelah pemeriksaan otorisasi.
      </p>

      <h2>Siapa yang Dapat Melihat Data Anda</h2>
      <ul>
        <li>Pelapor: hanya laporan miliknya sendiri.</li>
        <li>Verifikator: bukti dan detail laporan untuk keperluan verifikasi.</li>
        <li>Koordinator Respons: laporan yang sudah berstatus terverifikasi.</li>
        <li>Auditor: akses baca penuh untuk keperluan audit — tidak dapat mengubah data apa pun.</li>
        <li>
          Administrator Sistem: mengelola akun dan pengaturan sistem, tetapi tidak memvalidasi
          atau melihat detail bukti laporan sebagai bagian dari alur normalnya.
        </li>
      </ul>

      <h2>Retensi Data</h2>
      <p>
        Kebijakan retensi bukti mentah dapat dikonfigurasi oleh Administrator Sistem dan terlihat
        oleh Auditor. Lihat halaman{" "}
        <a href="/data-governance" className="font-semibold text-brand-signal-cyan hover:underline">
          Tata Kelola Data
        </a>{" "}
        untuk rincian lengkap.
      </p>

      <h2>Kontak</h2>
      <p>
        Pertanyaan terkait privasi dapat disampaikan melalui kontak yang tercantum pada halaman{" "}
        <a href="/methodology" className="font-semibold text-brand-signal-cyan hover:underline">
          Metodologi
        </a>
        .
      </p>
    </TrustPageLayout>
  );
}
