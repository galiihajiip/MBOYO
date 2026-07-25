"use client";

import { useState } from "react";

const FAQ_ITEMS = [
  {
    num: "01",
    question: "Apakah laporan bisa hilang jika saya sedang offline?",
    answer:
      "Tidak. Laporan disimpan di IndexedDB perangkat Anda begitu dibuat dan menunggu koneksi untuk disinkronkan secara otomatis dan idempoten.",
    tag: "Keandalan Offline",
  },
  {
    num: "02",
    question: "Apakah keputusan tingkat kerusakan dibuat oleh AI sepenuhnya?",
    answer:
      "Tidak. Model computer vision hanya memberikan sinyal awal. Keputusan akhir seperti konfirmasi, koreksi, penolakan, atau eskalasi selalu dilakukan oleh Verifikator manusia.",
    tag: "Human-in-Loop",
  },
  {
    num: "03",
    question: "Siapa yang dapat melihat foto dan lokasi laporan saya?",
    answer:
      "Hanya Verifikator, Koordinator Respons (untuk laporan terverifikasi), dan Auditor yang memiliki akses diatur oleh kebijakan akses RLS Postgres.",
    tag: "Privasi Data",
  },
  {
    num: "04",
    question: "Apakah MBOYO menggunakan AI pihak ketiga seperti Gemini?",
    answer:
      "Integrasi tersebut bersifat opsional, dinonaktifkan secara default, dan jika diaktifkan hanya memberikan konteks tambahan bagi Verifikator.",
    tag: "Integrasi AI",
  },
  {
    num: "05",
    question: "Bagaimana jika saya menemukan bug atau ingin memberi masukan?",
    answer:
      "Hubungi tim melalui kontak yang tercantum pada halaman Metodologi. Kami mencatat setiap masukan sebagai bagian dari proses evaluasi.",
    tag: "Dukungan Tim",
  },
] as const;

/**
 * Creative & Ultra-Elegant FAQ Section — Asymmetric split layout with dark spotlight sidebar
 * and floating interactive numbered cards. Zero em-dashes (—).
 */
export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-10">
      <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
        {/* Left Column: Dark Navy Glassmorphism Spotlight Card */}
        <div className="flex flex-col justify-between rounded-3xl border border-brand-signal-cyan/30 bg-gradient-to-br from-[#06141f] via-[#082032] to-[#0b3a53] p-8 text-white shadow-2xl lg:col-span-5 lg:sticky lg:top-28">
          <div className="flex flex-col gap-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-signal-cyan/40 bg-brand-signal-cyan/10 px-3.5 py-1 font-mono text-xs font-semibold text-brand-signal-cyan self-start">
              PUSAT BANTUAN & JAWABAN
            </span>

            <h2 className="font-sans text-2xl font-extrabold leading-tight text-white sm:text-3xl lg:text-4xl">
              Pertanyaan yang Sering Diajukan
            </h2>

            <p className="font-sans text-sm text-slate-300 leading-relaxed">
              Pahami bagaimana MBOYO menjaga keandalan laporan offline, privasi data geospasial, dan integrasi AI lokal secara transparan.
            </p>
          </div>

          <div className="mt-8 border-t border-white/10 pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-signal-cyan/20 text-brand-signal-cyan border border-brand-signal-cyan/40">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="font-sans text-xs font-bold text-white">Butuh Penjelasan Tambahan?</span>
                <span className="font-sans text-xs text-slate-400">Tim Dukungan MBOYO Siap Membantu 24/7</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Floating Interactive Numbered FAQ Cards */}
        <div className="flex flex-col gap-4 lg:col-span-7">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={item.num}
                className={`group rounded-2xl border transition-all duration-300 ${
                  isOpen
                    ? "border-brand-signal-cyan/60 bg-surface-container-lowest shadow-xl"
                    : "border-brand-border bg-surface-container-lowest/80 shadow-sm hover:border-brand-border hover:bg-surface-container-lowest"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(index)}
                  className="flex w-full min-h-14 items-center justify-between gap-4 p-5 text-left outline-none"
                >
                  <div className="flex items-center gap-3.5">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-extrabold transition-colors ${
                        isOpen
                          ? "bg-brand-ink-navy text-brand-signal-cyan"
                          : "bg-surface-container-low text-on-surface-variant group-hover:bg-brand-mist"
                      }`}
                    >
                      {item.num}
                    </span>
                    <span className="font-sans text-sm font-bold text-on-surface sm:text-base">
                      {item.question}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden sm:inline-block rounded-md border border-brand-border bg-surface-container-low px-2 py-0.5 font-mono text-[10px] font-semibold text-on-surface-variant">
                      {item.tag}
                    </span>
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-300 ${
                        isOpen ? "rotate-180 bg-brand-signal-cyan/15 text-brand-signal-cyan" : "text-on-surface-variant"
                      }`}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1">
                    <div className="border-t border-brand-border/60 pt-3 font-sans text-xs leading-relaxed text-on-surface-variant">
                      {item.answer}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
