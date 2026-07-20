import { requireRole } from "../../lib/auth/server";
import { AppShell } from "../../components/shell/AppShell";

export const dynamic = "force-dynamic";

export default async function CommandLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("response_coordinator");

  return (
    <AppShell role="response_coordinator" displayName={user.displayName}>
      {children}
    </AppShell>
  );
}
