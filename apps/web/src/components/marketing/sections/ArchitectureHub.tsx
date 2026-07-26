"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

/**
 * ArchitectureHub — Clean, compact tabbed section with zero em-dashes (—) and zero emojis.
 */
export function ArchitectureHub() {
  const [activeTab, setActiveTab] = useState<"offline" | "ai" | "geospatial" | "security">("offline");

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === "#keamanan-data" || hash === "#keamanan") {
        setActiveTab("security");
      }
    };
    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return (
    <section id="keamanan-data" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-10">
      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-signal-cyan/40 bg-brand-signal-cyan/10 px-3.5 py-1 font-mono text-xs font-bold text-brand-signal-cyan">
          BUKAN SEKADAR KLAIM
        </span>
        <h2 className="mt-3 font-sans text-2xl font-extrabold text-on-surface sm:text-3xl lg:text-4xl">
          Ini Cara Kami Menjaga Kepercayaan Anda
        </h2>
        <p className="mt-3 font-sans text-base text-on-surface-variant">
          Pilih salah satu topik di bawah untuk melihat bagaimana MBOYO bekerja tanpa sinyal, bagaimana AI
          dan petugas saling melengkapi, bagaimana peta bantuan berjalan, dan bagaimana data Anda dijaga.
        </p>
      </div>

      {/* Tab Controls */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-brand-border bg-surface-container-low p-2 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab("offline")}
          className={`flex min-h-11 items-center gap-2 rounded-xl px-4 font-sans text-sm font-bold transition-all ${
            activeTab === "offline"
              ? "bg-brand-ink-navy text-white shadow-md"
              : "text-on-surface-variant hover:bg-surface-container-lowest hover:text-on-surface"
          }`}
        >
          <span>Tanpa Internet</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ai")}
          className={`flex min-h-11 items-center gap-2 rounded-xl px-4 font-sans text-sm font-bold transition-all ${
            activeTab === "ai"
              ? "bg-brand-ink-navy text-white shadow-md"
              : "text-on-surface-variant hover:bg-surface-container-lowest hover:text-on-surface"
          }`}
        >
          <span>AI & Petugas</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("geospatial")}
          className={`flex min-h-11 items-center gap-2 rounded-xl px-4 font-sans text-sm font-bold transition-all ${
            activeTab === "geospatial"
              ? "bg-brand-ink-navy text-white shadow-md"
              : "text-on-surface-variant hover:bg-surface-container-lowest hover:text-on-surface"
          }`}
        >
          <span>Peta Bantuan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("security")}
          className={`flex min-h-11 items-center gap-2 rounded-xl px-4 font-sans text-sm font-bold transition-all ${
            activeTab === "security"
              ? "bg-brand-ink-navy text-white shadow-md"
              : "text-on-surface-variant hover:bg-surface-container-lowest hover:text-on-surface"
          }`}
        >
          <span>Keamanan & Data</span>
        </button>
      </div>

      {/* Tab Content Display */}
      <div className="mt-6 rounded-3xl border border-brand-border bg-surface-container-lowest p-6 shadow-xl sm:p-10">
        {activeTab === "offline" && (
          <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
            <div className="flex flex-col gap-4 lg:col-span-7">
              <span className="font-mono text-xs font-bold text-brand-signal-cyan uppercase tracking-wider">
                BUKAN SEKADAR JANJI DI IKLAN
              </span>
              <h3 className="font-sans text-2xl font-extrabold text-on-surface">
                Laporan Anda Tersimpan Aman, Bahkan Tanpa Sinyal
              </h3>
              <ul className="flex flex-col gap-3 font-sans text-sm text-on-surface-variant">
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-safe-green text-xs font-bold text-white">✓</span>
                  <span><strong>Tersimpan Langsung di HP:</strong> Laporan tersimpan di perangkat Anda seketika, tidak pernah menunggu jaringan untuk tersimpan.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-safe-green text-xs font-bold text-white">✓</span>
                  <span><strong>Tidak Hilang Saat Restart:</strong> Antrean laporan tetap ada meski HP dimatikan, aplikasi ditutup, atau baterai habis.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-safe-green text-xs font-bold text-white">✓</span>
                  <span><strong>Terkirim Sendiri Otomatis:</strong> Begitu sinyal atau Wi-Fi kembali, laporan langsung terkirim tanpa perlu Anda buka aplikasi lagi.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-safe-green text-xs font-bold text-white">✓</span>
                  <span><strong>Tidak Pernah Terkirim Dua Kali:</strong> Percobaan ulang pengiriman tidak pernah menghasilkan laporan ganda di database.</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-brand-border bg-surface-container-low p-5 lg:col-span-5">
              <span className="font-sans text-xs font-bold text-on-surface uppercase tracking-wide">
                Status Terlihat Langsung di Aplikasi
              </span>
              <div className="flex items-center justify-between rounded-xl bg-brand-caution-amber/15 border border-brand-caution-amber/40 p-3">
                <span className="font-sans text-xs font-semibold text-[#7a5109]">Anda Sedang Offline</span>
                <span className="font-mono text-xs font-bold text-[#7a5109]">Menunggu Sinkronisasi (3)</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-brand-safe-green/15 border border-brand-safe-green/40 p-3">
                <span className="font-sans text-xs font-semibold text-emerald-900">Online</span>
                <span className="font-mono text-xs font-bold text-emerald-900">Tersinkronisasi 100%</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "ai" && (
          <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
            <div className="flex flex-col gap-4 lg:col-span-7">
              <span className="font-mono text-xs font-bold text-brand-caution-amber uppercase tracking-wider">
                AI MENYARING, MANUSIA MEMUTUSKAN
              </span>
              <h3 className="font-sans text-2xl font-extrabold text-on-surface">
                AI Membantu Cepat, Petugas Tetap Pegang Keputusan
              </h3>
              <p className="font-sans text-sm text-on-surface-variant leading-relaxed">
                Setiap foto yang masuk langsung diberi perkiraan awal seberapa parah kerusakannya oleh AI yang
                berjalan di server kami sendiri. Perkiraan ini membantu petugas tahu laporan mana yang perlu
                dicek lebih dulu. Tapi AI tidak pernah punya kata akhir — setiap laporan tetap harus dikonfirmasi,
                diperbaiki, atau ditolak oleh petugas manusia sebelum dianggap sah.
              </p>
              <p className="font-sans text-xs text-on-surface-variant italic bg-surface-container-low p-3 rounded-xl border border-brand-border">
                Jika model belum memenuhi ambang evaluasi yang ditetapkan, hasilnya ditandai sebagai saran, bukan keputusan. Verifikator tetap melakukan tinjauan manual penuh.
              </p>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-brand-border bg-surface-container-low p-5 lg:col-span-5">
              <span className="font-sans text-xs font-bold text-on-surface">
                Contoh Ilustratif: Probabilitas Tingkat Keparahan
              </span>
              <span className="font-mono text-[10px] text-on-surface-variant">
                (Data ilustrasi demonstrasi model)
              </span>

              <div className="flex flex-col gap-2 pt-1 font-sans text-xs">
                <div className="flex items-center justify-between">
                  <span>Tidak Diketahui</span>
                  <span className="font-mono font-bold">2%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-brand-border overflow-hidden">
                  <div className="h-full bg-slate-400" style={{ width: "2%" }} />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span>Tidak Ada Kerusakan</span>
                  <span className="font-mono font-bold text-brand-safe-green">5%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-brand-border overflow-hidden">
                  <div className="h-full bg-brand-safe-green" style={{ width: "5%" }} />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span>Kerusakan Ringan</span>
                  <span className="font-mono font-bold text-brand-caution-amber">18%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-brand-border overflow-hidden">
                  <div className="h-full bg-brand-caution-amber" style={{ width: "18%" }} />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span>Kerusakan Berat</span>
                  <span className="font-mono font-bold text-brand-priority-orange">55%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-brand-border overflow-hidden">
                  <div className="h-full bg-brand-priority-orange" style={{ width: "55%" }} />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span>Hancur Total</span>
                  <span className="font-mono font-bold text-brand-critical-red">20%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-brand-border overflow-hidden">
                  <div className="h-full bg-brand-critical-red" style={{ width: "20%" }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "geospatial" && (
          <div className="flex flex-col gap-4">
            <span className="font-mono text-xs font-bold text-brand-relief-teal uppercase tracking-wider">
              SEMUA LAPORAN, SATU PETA
            </span>
            <h3 className="font-sans text-2xl font-extrabold text-on-surface">
              Tim Bantuan Tahu Persis Harus Kemana
            </h3>
            <p className="font-sans text-sm text-on-surface-variant leading-relaxed">
              Setiap laporan yang sudah dikonfirmasi langsung muncul di peta bantuan koordinator, dikelompokkan
              otomatis berdasarkan kedekatan lokasinya. Koordinator bisa melihat mana yang paling mendesak,
              menggabungkan laporan yang berasal dari satu lokasi kejadian, dan menugaskan tim ke sana — semua
              dari satu layar.
            </p>
            <div className="rounded-xl border border-brand-border bg-surface-container-low p-4 font-sans text-xs text-on-surface-variant">
              <strong>Dukungan Aksesibilitas Cadangan:</strong> Jika peta tidak dapat dimuat, tampilan daftar tetap tersedia sebagai cadangan. Peta adalah peningkatan pengalaman, bukan satu-satunya jalan untuk melihat insiden.
            </div>
          </div>
        )}

        {activeTab === "security" && (
          <div className="flex flex-col gap-4">
            <span className="font-mono text-xs font-bold text-brand-critical-red uppercase tracking-wider">
              DATA ANDA BUKAN UNTUK SEMBARANG ORANG
            </span>
            <h3 className="font-sans text-2xl font-extrabold text-on-surface">
              Data Korban dan Lokasi Bencana Kami Jaga Ketat
            </h3>
            <p className="font-sans text-sm text-on-surface-variant">
              Foto dan lokasi bencana adalah informasi sensitif. MBOYO dirancang supaya data itu tetap privat
              dan setiap aksesnya bisa ditelusuri kembali.
            </p>

            <div className="grid gap-4 sm:grid-cols-2 pt-2">
              <div className="rounded-xl border border-brand-border bg-surface-container-low p-4">
                <h4 className="font-sans text-xs font-bold text-on-surface">Foto Anda Tidak Bisa Dilihat Sembarangan</h4>
                <p className="mt-1 font-sans text-xs text-on-surface-variant leading-relaxed">
                  Foto laporan disimpan di tempat privat, tidak pernah bisa dibuka lewat tautan publik tanpa izin.
                </p>
              </div>

              <div className="rounded-xl border border-brand-border bg-surface-container-low p-4">
                <h4 className="font-sans text-xs font-bold text-on-surface">AI Kami Sendiri, Bukan Titip ke Pihak Luar</h4>
                <p className="mt-1 font-sans text-xs text-on-surface-variant leading-relaxed">
                  Penilaian kerusakan utama dijalankan oleh model AI milik kami sendiri, bukan dikirim ke layanan pihak ketiga.
                </p>
              </div>

              <div className="rounded-xl border border-brand-border bg-surface-container-low p-4">
                <h4 className="font-sans text-xs font-bold text-on-surface">AI Tambahan Bersifat Opsional</h4>
                <p className="mt-1 font-sans text-xs text-on-surface-variant leading-relaxed">
                  Jika diaktifkan, Gemini hanya memberi konteks tambahan bagi petugas, tidak pernah menjadi keputusan otomatis.
                </p>
              </div>

              <div className="rounded-xl border border-brand-border bg-surface-container-low p-4">
                <h4 className="font-sans text-xs font-bold text-on-surface">Data Tidak Disimpan Selamanya</h4>
                <p className="mt-1 font-sans text-xs text-on-surface-variant leading-relaxed">
                  Ada aturan jelas berapa lama bukti foto disimpan, dan setiap perubahannya bisa dicek oleh auditor independen.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-3 font-sans text-xs font-bold text-brand-signal-cyan">
              <Link href="/data-governance" className="hover:underline">
                Baca Tata Kelola Data lengkap &rarr;
              </Link>
              <Link href="/privacy" className="hover:underline">
                Baca Kebijakan Privasi &rarr;
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
