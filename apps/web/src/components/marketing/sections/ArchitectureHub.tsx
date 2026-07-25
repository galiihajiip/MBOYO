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
          ARSITEKTUR & KEAMANAN
        </span>
        <h2 className="mt-3 font-sans text-2xl font-extrabold text-on-surface sm:text-3xl lg:text-4xl">
          Bukti Keandalan Sistem MBOYO
        </h2>
        <p className="mt-3 font-sans text-base text-on-surface-variant">
          Pilih tab di bawah untuk melihat rincian arsitektur offline, triase vision AI, komando geospasial, dan keamanan data.
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
          <span>Offline-First PWA</span>
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
          <span>AI + Verifikasi Manusia</span>
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
          <span>Peta Geospasial</span>
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
                BUKTI TEKNIS OFFLINE-FIRST
              </span>
              <h3 className="font-sans text-2xl font-extrabold text-on-surface">
                Offline Bukan Sekadar Klaim: Tersimpan Aman di IndexedDB
              </h3>
              <ul className="flex flex-col gap-3 font-sans text-sm text-on-surface-variant">
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-safe-green text-xs font-bold text-white">✓</span>
                  <span><strong>IndexedDB Perangkat:</strong> Laporan disimpan di IndexedDB lokal, tidak pernah menunggu jaringan untuk tersimpan.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-safe-green text-xs font-bold text-white">✓</span>
                  <span><strong>Bertahan Restart:</strong> Antrean laporan bertahan meski halaman dimuat ulang atau aplikasi ditutup sepenuhnya.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-safe-green text-xs font-bold text-white">✓</span>
                  <span><strong>Workbox Background Sync:</strong> Menyinkronkan otomatis begitu koneksi kembali, tanpa perlu aksi manual pengguna.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-safe-green text-xs font-bold text-white">✓</span>
                  <span><strong>Idempoten:</strong> Percobaan ulang pengiriman tidak pernah menghasilkan laporan ganda di database.</span>
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
                COMPUTER VISION + HUMAN-IN-THE-LOOP
              </span>
              <h3 className="font-sans text-2xl font-extrabold text-on-surface">
                AI Menyaring, Manusia Memutuskan
              </h3>
              <p className="font-sans text-sm text-on-surface-variant leading-relaxed">
                Model computer vision lokal menghasilkan probabilitas tingkat keparahan untuk setiap laporan. Sinyal awal membantu Verifikator memprioritaskan peninjauan. Model tidak pernah membuat keputusan akhir: setiap laporan tetap memerlukan konfirmasi, koreksi, atau penolakan dari Verifikator manusia sebelum menjadi insiden terverifikasi.
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
              POSTGIS COMMAND CENTER
            </span>
            <h3 className="font-sans text-2xl font-extrabold text-on-surface">
              Koordinasi Respons Berbasis Lokasi Geospasial
            </h3>
            <p className="font-sans text-sm text-on-surface-variant leading-relaxed">
              Insiden yang terverifikasi tampil pada peta krisis Koordinator secara langsung, dikelompokkan berdasarkan kedekatan lokasi menggunakan PostGIS. Koordinator dapat menetapkan prioritas, mengelompokkan insiden terkait, dan menugaskan tim respons dari satu command center.
            </p>
            <div className="rounded-xl border border-brand-border bg-surface-container-low p-4 font-sans text-xs text-on-surface-variant">
              <strong>Dukungan Aksesibilitas Cadangan:</strong> Jika peta tidak dapat dimuat, tampilan daftar tetap tersedia sebagai cadangan. Peta adalah peningkatan pengalaman, bukan satu-satunya jalan untuk melihat insiden.
            </div>
          </div>
        )}

        {activeTab === "security" && (
          <div className="flex flex-col gap-4">
            <span className="font-mono text-xs font-bold text-brand-critical-red uppercase tracking-wider">
              KEDAULATAN & PRIVASI DATA BENCANA
            </span>
            <h3 className="font-sans text-2xl font-extrabold text-on-surface">
              Kedaulatan dan Keamanan Data Terjamin
            </h3>
            <p className="font-sans text-sm text-on-surface-variant">
              Data korban dan lokasi bencana adalah data sensitif, MBOYO dirancang untuk menjaganya tetap privat dan dapat diaudit.
            </p>

            <div className="grid gap-4 sm:grid-cols-2 pt-2">
              <div className="rounded-xl border border-brand-border bg-surface-container-low p-4">
                <h4 className="font-sans text-xs font-bold text-on-surface">Bukti Tersimpan Privat</h4>
                <p className="mt-1 font-sans text-xs text-on-surface-variant leading-relaxed">
                  Foto laporan disimpan di bucket privat, tidak pernah diakses melalui tautan publik tanpa otorisasi.
                </p>
              </div>

              <div className="rounded-xl border border-brand-border bg-surface-container-low p-4">
                <h4 className="font-sans text-xs font-bold text-on-surface">Model Lokal, Bukan Pihak Ketiga</h4>
                <p className="mt-1 font-sans text-xs text-on-surface-variant leading-relaxed">
                  Klasifikasi utama dijalankan oleh model computer vision yang dijalankan dan dievaluasi sendiri, bukan API eksternal.
                </p>
              </div>

              <div className="rounded-xl border border-brand-border bg-surface-container-low p-4">
                <h4 className="font-sans text-xs font-bold text-on-surface">AI Eksternal Opsional & Saran</h4>
                <p className="mt-1 font-sans text-xs text-on-surface-variant leading-relaxed">
                  Jika diaktifkan, Gemini hanya memberi konteks tambahan bagi Verifikator, tidak pernah menjadi keputusan otomatis.
                </p>
              </div>

              <div className="rounded-xl border border-brand-border bg-surface-container-low p-4">
                <h4 className="font-sans text-xs font-bold text-on-surface">Retensi Data Dikonfigurasi</h4>
                <p className="mt-1 font-sans text-xs text-on-surface-variant leading-relaxed">
                  Kebijakan retensi bukti mentah ditentukan oleh Administrator Sistem dan terlihat oleh Auditor.
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
