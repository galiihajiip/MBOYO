import type { Metadata } from "next";
import { LoginForm } from "../(auth)/masuk/LoginForm";

export const metadata: Metadata = {
  title: "Sesi Berakhir — MBOYO",
};

/**
 * Session Expired / Re-authenticate screen per
 * docs/product/SCREEN_INVENTORY.md — reuses the Login form/component
 * rather than a separate implementation, per that screen's spec ("reuses
 * the Login screen/component"). Does not discard any client-side state
 * (e.g. a Reporter's in-progress local report draft lives in IndexedDB,
 * entirely independent of this server-rendered page).
 */
export default async function SessionExpiredPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-10">
      <p className="max-w-sm text-center font-sans text-sm text-on-surface-variant">
        Sesi Anda telah berakhir. Silakan masuk kembali untuk melanjutkan.
      </p>
      <LoginForm demoMode={demoMode} next={next} />
    </main>
  );
}
