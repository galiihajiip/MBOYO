import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Masuk — MBOYO",
  description: "Masuk ke platform MBOYO untuk mengelola laporan bencana, verifikasi, dan koordinasi respons.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const demoMode =
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    process.env.DEMO_MODE === "true" ||
    process.env.NODE_ENV === "development";

  return (
    <main className="relative flex min-h-screen w-full flex-col lg:flex-row bg-surface">
      {/* Top Floating Back to Home button for Mobile & Quick Access */}
      <div className="absolute top-4 right-4 z-50 lg:hidden">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-brand-border bg-surface-container-lowest px-4 py-2 font-sans text-xs font-bold text-on-surface shadow-sm hover:bg-surface-container-low"
        >
          <span>&larr;</span>
          <span>Kembali ke Beranda</span>
        </Link>
      </div>

      {/* Left Column: Brand Showcase Banner */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#06141f] via-[#082032] to-[#0b3a53] p-8 text-white lg:w-1/2 lg:p-16">
        {/* Subtle Decorative Grid Pattern */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(#18b6c9_1px,transparent_1px)] [background-size:24px_24px] opacity-15"
          aria-hidden="true"
        />

        {/* Brand Logo Header & Desktop Back Button */}
        <div className="relative z-10 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image src="/icons/logo.svg" alt="" width={40} height={40} priority />
            <span className="font-sans text-2xl font-extrabold tracking-tight text-white">MBOYO</span>
          </Link>

          <Link
            href="/"
            className="hidden items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 font-sans text-xs font-bold text-white backdrop-blur transition-all hover:bg-white/20 sm:inline-flex"
          >
            <span>&larr;</span>
            <span>Kembali ke Beranda</span>
          </Link>
        </div>

        {/* Hero Title & Explanation */}
        <div className="relative z-10 my-auto flex flex-col gap-6 py-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-signal-cyan/40 bg-brand-signal-cyan/10 px-3.5 py-1 font-mono text-xs font-semibold text-brand-signal-cyan self-start">
            PLATFORM TANGGAP BENCANA OFFLINE-FIRST
          </div>

          <h1 className="font-sans text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl lg:leading-[58px]">
            HALO CAK, <br />
            <span className="bg-gradient-to-r from-brand-signal-cyan via-emerald-300 to-brand-caution-amber bg-clip-text text-transparent">
              MBAK & NING!
            </span>
          </h1>

          <p className="max-w-md font-sans text-base leading-relaxed text-slate-300">
            Laporan tetap jalan meski tanpa sinyal seluler. Dilengkapi triase vision AI lokal, verifikasi manusia 100%, dan koordinasi respons geospasial di satu command center.
          </p>

          <div className="flex flex-wrap gap-4 pt-2 font-mono text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-brand-safe-green" /> 100% Offline IndexedDB
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-brand-signal-cyan" /> ONNX Vision AI
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-brand-caution-amber" /> Human-in-the-Loop
            </span>
          </div>
        </div>

        {/* Footer Attribution */}
        <div className="relative z-10 font-mono text-xs text-slate-400">
          &copy; {new Date().getFullYear()} Tim VETERAN KUKUS. Hak Cipta Dilindungi.
        </div>
      </div>

      {/* Right Column: Interactive Login Form */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:w-1/2 lg:px-20 bg-surface-container-lowest">
        <div className="mx-auto w-full max-w-md">
          <LoginForm demoMode={demoMode} next={next} />
        </div>
      </div>
    </main>
  );
}
