import { requireRole } from "../../lib/auth/server";
import { AppShell } from "../../components/shell/AppShell";

export const dynamic = "force-dynamic";

export default async function VerifierLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("verifier");

  return (
    <AppShell role="verifier" displayName={user.displayName}>
      {children}
    </AppShell>
  );
}
