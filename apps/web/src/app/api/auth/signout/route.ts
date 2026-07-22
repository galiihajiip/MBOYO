import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("mboyo_demo_role");
  cookieStore.delete("mboyo_demo_email");
  cookieStore.delete("sb-access-token");
  cookieStore.delete("sb-refresh-token");

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const cookieStore = await cookies();
  cookieStore.delete("mboyo_demo_role");
  cookieStore.delete("mboyo_demo_email");
  cookieStore.delete("sb-access-token");
  cookieStore.delete("sb-refresh-token");

  return NextResponse.redirect(new URL("/masuk", "http://localhost:3000"));
}
