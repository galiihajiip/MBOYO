"use client";

/**
 * Demo account chooser — renders ONLY when NEXT_PUBLIC_DEMO_MODE is true,
 * per this block's "demo chooser only in demo mode" requirement and
 * AGENTS.md's demo-fallback disclosure rule (visibly labeled, never the
 * default in any environment other than an explicitly configured demo
 * deployment). Selecting an account fills the form fields; it does not
 * submit or bypass the real signInWithPassword() server action — the demo
 * account still authenticates through the exact same path a real account would.
 */

const DEMO_ACCOUNTS = [
  { label: "Pelapor (Reporter)", email: "reporter@mboyo.demo" },
  { label: "Verifikator (Verifier)", email: "verifier@mboyo.demo" },
  { label: "Koordinator Respons (Coordinator)", email: "coordinator@mboyo.demo" },
  { label: "Administrator Sistem (Admin)", email: "admin@mboyo.demo" },
  { label: "Auditor", email: "auditor@mboyo.demo" },
] as const;

const DEMO_PASSWORD = "DemoMboyo2026!";

export interface DemoAccountChooserProps {
  demoMode: boolean;
  onSelect: (email: string, password: string) => void;
}

export function DemoAccountChooser({ demoMode, onSelect }: DemoAccountChooserProps) {
  if (!demoMode) return null;

  return (
    <div className="mt-6 rounded-md border border-brand-caution-amber/40 bg-brand-caution-amber/10 p-4">
      <p className="font-sans text-xs font-bold uppercase tracking-wide text-[#7a5109]">
        Mode Demo Aktif — akun di bawah ini hanya untuk demonstrasi
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {DEMO_ACCOUNTS.map((account) => (
          <button
            key={account.email}
            type="button"
            onClick={() => onSelect(account.email, DEMO_PASSWORD)}
            className="flex min-h-11 items-center justify-between rounded-sm border border-brand-border bg-surface-container-lowest px-3 text-left font-sans text-sm text-on-surface hover:bg-brand-mist"
          >
            <span>{account.label}</span>
            <span className="font-mono text-xs text-on-surface-variant">{account.email}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
