"use client";

const DEMO_ACCOUNTS = [
  { role: "Pelapor Warga", email: "reporter@mboyo.demo", badgeColor: "bg-brand-signal-cyan/10 text-brand-signal-cyan border-brand-signal-cyan/30" },
  { role: "Petugas Verifikator", email: "verifier@mboyo.demo", badgeColor: "bg-brand-relief-teal/10 text-brand-relief-teal border-brand-relief-teal/30" },
  { role: "Koordinator Respons", email: "coordinator@mboyo.demo", badgeColor: "bg-brand-priority-orange/10 text-brand-priority-orange border-brand-priority-orange/30" },
  { role: "Administrator Sistem", email: "admin@mboyo.demo", badgeColor: "bg-brand-critical-red/10 text-brand-critical-red border-brand-critical-red/30" },
  { role: "Auditor Independen", email: "auditor@mboyo.demo", badgeColor: "bg-brand-slate/10 text-brand-slate border-brand-slate/30" },
] as const;

const DEMO_PASSWORD = "DemoMboyo2026!";

export interface DemoAccountChooserProps {
  demoMode: boolean;
  onSelect: (email: string, password: string) => void;
}

export function DemoAccountChooser({ demoMode, onSelect }: DemoAccountChooserProps) {
  if (!demoMode) return null;

  return (
    <div className="mt-4 rounded-2xl border border-brand-caution-amber/40 bg-brand-caution-amber/5 p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-brand-caution-amber/20 pb-2">
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#7a5109]">
          Pilihan Akun Demo Instan
        </span>
        <span className="font-mono text-[10px] font-semibold text-[#7a5109]">
          Klik untuk Isi Otomatis
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {DEMO_ACCOUNTS.map((account) => (
          <button
            key={account.email}
            type="button"
            onClick={() => onSelect(account.email, DEMO_PASSWORD)}
            className="flex min-h-11 items-center justify-between rounded-xl border border-brand-border bg-surface-container-lowest px-3 text-left font-sans text-xs text-on-surface transition-all hover:border-brand-signal-cyan hover:bg-brand-mist/50"
          >
            <span className="font-bold">{account.role}</span>
            <span className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold ${account.badgeColor}`}>
              {account.email}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
