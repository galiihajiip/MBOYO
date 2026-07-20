import { requireRole } from "../../lib/auth/server";
import { AppShell } from "../../components/shell/AppShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("system_administrator");

  return (
    <AppShell role="system_administrator" displayName={user.displayName}>
      {children}
    </AppShell>
  );
}
