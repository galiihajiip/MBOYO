import type { Metadata } from "next";
import { TrustPageLayout } from "../../components/marketing/TrustPageLayout";

export const metadata: Metadata = {
  title: "Aksesibilitas — MBOYO",
  description: "Komitmen dan status aksesibilitas platform MBOYO.",
  alternates: { canonical: "/accessibility" },
};

export default function AccessibilityPage() {
  return (
    <TrustPageLayout title="Aksesibilitas" lastUpdated="16 Juli 2026">
      <p>
        MBOYO menargetkan kesesuaian WCAG 2.1 AA secara bertahap di seluruh antarmuka lima peran.
        Halaman ini menjelaskan apa yang sudah diterapkan dan apa yang masih dalam proses.
      </p>

      <h2>Yang Sudah Diterapkan</h2>
      <ul>
        <li>Target sentuh minimum 44&times;44 piksel pada seluruh elemen interaktif.</li>
        <li>Indikator fokus (focus ring) yang terlihat jelas pada setiap elemen yang dapat difokuskan, menggunakan warna kontras tinggi.</li>
        <li>Dukungan <code>prefers-reduced-motion</code> — animasi dinonaktifkan otomatis bagi pengguna yang mengaktifkan preferensi tersebut di perangkatnya.</li>
        <li>Warna tidak pernah menjadi satu-satunya penanda status atau tingkat keparahan — selalu disertai label teks.</li>
        <li>Teks pada label kuning/amber menggunakan warna gelap agar kontras tetap terbaca, bukan putih di atas kuning.</li>
        <li>Markup semantik (tabel data menggunakan elemen <code>&lt;table&gt;</code> sesungguhnya, bukan <code>&lt;div&gt;</code>) agar kompatibel dengan pembaca layar.</li>
      </ul>

      <h2>Yang Masih Dalam Proses</h2>
      <ul>
        <li>Audit aksesibilitas otomatis (axe-core) dan manual secara menyeluruh di setiap antarmuka peran.</li>
        <li>Kesesuaian WCAG 2.1 AA penuh ditargetkan pada tahap produksi, dengan pencapaian dasar pada tahap demo lanjutan.</li>
      </ul>

      <h2>Memberi Masukan</h2>
      <p>
        Jika Anda menemukan hambatan aksesibilitas saat menggunakan MBOYO, sampaikan melalui
        kontak yang tercantum pada halaman{" "}
        <a href="/methodology" className="font-semibold text-brand-signal-cyan hover:underline">
          Metodologi
        </a>
        .
      </p>
    </TrustPageLayout>
  );
}
