"use client";

import { useActionState, useState } from "react";
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
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4 rounded-lg border border-brand-border bg-surface-container-lowest p-6">
      <h1 className="font-sans text-2xl font-bold text-on-surface">Masuk ke MBOYO</h1>

      <form action={formAction} className="flex flex-col gap-3">
        {next ? <input type="hidden" name="next" value={next} /> : null}

        <label className="flex flex-col gap-1">
          <span className="font-sans text-sm font-medium text-on-surface">Email</span>
          <Input
            type="email"
            name="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-sans text-sm font-medium text-on-surface">Kata Sandi</span>
          <Input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {state.error ? (
          <p role="alert" className="font-sans text-sm text-brand-critical-red">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" disabled={isPending}>
          {isPending ? "Memproses..." : "Masuk"}
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
