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

/**
 * Server Action for sign-in. The Supabase session is established entirely
 * server-side via createServerSupabaseClient() (an @supabase/ssr client
 * backed by next/headers cookies()) — signInWithPassword() here writes the
 * session to an HTTP-only cookie through that client's cookie adapter.
 * Nothing in this flow touches localStorage/sessionStorage; there is no
 * client-side Supabase auth call anywhere in the login path, satisfying
 * "no localStorage auth token" and "server session."
 */
export async function signInAction(_prevState: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return { error: "Email atau kata sandi tidak valid." };
  }

  // Keyed on (email, IP) together: throttles repeated attempts against one
  // account from one source without locking out an entire shared network
  // (common at a disaster response site) the moment any single user on it
  // mistypes a password a few times.
  const requestHeaders = await headers();
  const clientIp = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimit = checkRateLimit(
    { key: "login", limit: 10, windowMs: 60_000 },
    `${parsed.data.email.toLowerCase()}:${clientIp}`,
  );
  if (!rateLimit.allowed) {
    return { error: "Terlalu banyak percobaan masuk. Coba lagi sebentar lagi." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    // Deliberately generic per docs/product/CONTENT_GUIDE.md error message
    // conventions — never confirm/deny whether a given email is registered.
    return { error: "Email atau kata sandi salah." };
  }

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

/** Signs out the current session (clears the server-side cookie via Supabase Auth). */
export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/masuk");
}
