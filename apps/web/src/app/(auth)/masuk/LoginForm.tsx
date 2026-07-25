"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button, Input } from "@mboyo/ui";
import { signInAction, type SignInState } from "./actions";
import { DemoAccountChooser } from "./DemoAccountChooser";

const initialState: SignInState = { error: null };

export interface LoginFormProps {
  demoMode: boolean;
  next?: string;
}

export function LoginForm({ demoMode, next }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(signInAction, initialState);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-sans text-3xl font-extrabold text-on-surface">
          Selamat Datang Kembali!
        </h2>
        <p className="mt-2 font-sans text-sm text-on-surface-variant">
          Masuk ke akun Anda atau pilih salah satu akun demo di bawah ini.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}

        <label className="flex flex-col gap-1.5">
          <span className="font-sans text-sm font-semibold text-on-surface">Alamat Email</span>
          <Input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder="nama@domain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-11 rounded-lg border-brand-border bg-surface-container-low focus:bg-white"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="font-sans text-sm font-semibold text-on-surface">Kata Sandi</span>
            <Link
              href="/lupa-kata-sandi"
              className="font-sans text-xs font-semibold text-brand-signal-cyan hover:underline"
            >
              Lupa kata sandi?
            </Link>
          </div>
          <Input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-11 rounded-lg border-brand-border bg-surface-container-low focus:bg-white"
          />
        </label>

        {state.error ? (
          <div role="alert" className="rounded-lg border border-brand-critical-red/30 bg-brand-critical-red/10 p-3 font-sans text-xs font-semibold text-brand-critical-red">
            {state.error}
          </div>
        ) : null}

        <Button
          type="submit"
          disabled={isPending}
          className="mt-2 min-h-12 w-full rounded-xl bg-brand-ink-navy font-sans text-base font-bold text-white transition-all hover:bg-brand-deep-ocean shadow-md"
        >
          {isPending ? "Memproses..." : "Masuk Sekarang"}
        </Button>
      </form>

      <DemoAccountChooser
        demoMode={demoMode}
        onSelect={(demoEmail, demoPassword) => {
          setEmail(demoEmail);
          setPassword(demoPassword);
        }}
      />
    </div>
  );
}
