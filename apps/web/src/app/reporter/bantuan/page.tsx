import type { Metadata } from "next";

export const metadata: Metadata = { title: "Bantuan — MBOYO" };

const FAQ = [
  {
    q: "Apakah laporan saya hilang jika saya sedang offline?",
    a: "Tidak. Laporan tersimpan di perangkat Anda begitu Anda membuatnya, dan akan otomatis terkirim begitu koneksi tersedia kembali.",
  },
  {
    q: "Mengapa foto saya ditandai buram atau gelap?",
    a: "Ini hanya perkiraan awal untuk membantu Anda — laporan tetap dapat dikirim meskipun foto belum sempurna. Jika memungkinkan, coba ambil ulang di tempat yang lebih terang atau dengan tangan yang lebih stabil.",
  },
  {
    q: "Bagaimana jika GPS saya tidak aktif atau tidak akurat?",
    a: "Anda tetap dapat melanjutkan dengan menandai lokasi secara manual melalui peta atau menuliskan alamat. Lokasi GPS bersifat perkiraan dan dapat bergeser beberapa meter.",
  },
  {
    q: "Apakah data saya aman?",
    a: "Foto dan lokasi Anda hanya dapat diakses oleh Verifikator dan Koordinator Respons untuk keperluan verifikasi dan koordinasi. Lihat Kebijakan Privasi untuk rincian lengkap.",
  },
];

export default function BantuanPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-sans text-2xl font-bold text-on-surface">Bantuan</h1>
      <div className="flex flex-col gap-3">
        {FAQ.map((item) => (
          <details key={item.q} className="rounded-lg border border-brand-border bg-surface-container-lowest p-4">
            <summary className="min-h-11 cursor-pointer font-sans text-sm font-semibold text-on-surface">
              {item.q}
            </summary>
            <p className="mt-2 font-sans text-sm text-on-surface-variant">{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
