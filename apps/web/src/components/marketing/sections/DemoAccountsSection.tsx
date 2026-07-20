import Link from "next/link";
import { RoleBadge } from "@mboyo/ui";
import type { Role } from "@mboyo/domain";

const DEMO_ACCOUNTS: { role: Role; email: string }[] = [
  { role: "reporter", email: "reporter@mboyo.demo" },
  { role: "verifier", email: "verifier@mboyo.demo" },
  { role: "response_coordinator", email: "coordinator@mboyo.demo" },
  { role: "system_administrator", email: "admin@mboyo.demo" },
  { role: "auditor", email: "auditor@mboyo.demo" },
];

/**
 * "Demo accounts" section — per this block's spec and the demo-mode
 * disclosure rule in AGENTS.md: demo credentials are only ever shown when
 * NEXT_PUBLIC_DEMO_MODE is true (this section is server-rendered and reads
 * process.env directly, so the credentials never even reach the HTML when
 * demo mode is off — not just hidden by CSS/JS).
 */
export function DemoAccountsSection() {
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  return (
    <section id="akun-demo" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-sans text-2xl font-bold text-on-surface sm:text-3xl">
          Coba Command Center dengan Akun Demo
        </h2>
      </div>

      {demoMode ? (
        <div className="mt-10 overflow-hidden rounded-lg border border-brand-caution-amber/40 bg-brand-caution-amber/10">
          <p className="border-b border-brand-caution-amber/40 px-4 py-2 font-sans text-xs font-bold uppercase tracking-wide text-[#7a5109]">
            Mode Demo Aktif — akun di bawah ini hanya untuk demonstrasi
          </p>
          <div className="grid gap-px bg-brand-border sm:grid-cols-2 lg:grid-cols-5">
            {DEMO_ACCOUNTS.map((account) => (
              <div key={account.email} className="flex flex-col gap-2 bg-surface-container-lowest p-4">
                <RoleBadge role={account.role} />
                <span className="font-mono text-xs text-on-surface-variant">{account.email}</span>
              </div>
            ))}
          </div>
          <div className="p-4">
            <Link
              href="/masuk"
              className="inline-flex min-h-11 items-center rounded-md bg-brand-ink-navy px-4 font-sans text-sm font-semibold text-brand-cloud-white hover:bg-brand-deep-ocean"
            >
              Buka Halaman Masuk
            </Link>
          </div>
        </div>
      ) : (
        <p className="mt-10 text-center font-sans text-sm text-on-surface-variant">
          Akun demo saat ini tidak diaktifkan pada lingkungan ini.
        </p>
      )}
    </section>
  );
}
