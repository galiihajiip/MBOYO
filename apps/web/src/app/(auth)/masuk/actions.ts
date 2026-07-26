"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import type { Role } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { ROLE_HOME_ROUTE } from "../../../lib/auth/route-map";
import { checkRateLimit } from "../../../lib/api/rate-limit";

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

export interface SignInState {
  error: string | null;
}

export async function signInAction(_prevState: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return { error: "Email atau kata sandi tidak valid." };
  }

  const requestHeaders = await headers();
  const clientIp = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimit = checkRateLimit(
    { key: "login", limit: 10, windowMs: 60_000 },
    `${parsed.data.email.toLowerCase()}:${clientIp}`,
  );
  if (!rateLimit.allowed) {
    return { error: "Terlalu banyak percobaan masuk. Coba lagi sebentar lagi." };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (!error && data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", data.user.id)
        .single();

      let roles: Role[] = [];
      if (profile) {
        const { data: roleRows } = await supabase
          .from("role_assignments")
          .select("role")
          .eq("profile_id", profile.id)
          .is("revoked_at", null);
        roles = (roleRows ?? []).map((row) => row.role as Role);
      }

      const destination =
        (parsed.data.next && parsed.data.next.startsWith("/") ? parsed.data.next : null) ??
        (roles[0] ? ROLE_HOME_ROUTE[roles[0]] : "/");

      redirect(destination);
    }
  } catch (e) {
    if ((e as Error & { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) {
      throw e;
    }
  }

  return { error: "Email atau kata sandi salah." };
}

/** Signs out the current session and redirects. */
export async function signOutAction(): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
  } catch {}

  redirect("/masuk");
}
