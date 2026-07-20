import { requireRole } from "../../lib/auth/server";
import { AppShell } from "../../components/shell/AppShell";

export const dynamic = "force-dynamic";

export default async function AuditLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("auditor");

  return (
    <AppShell role="auditor" displayName={user.displayName}>
      {children}
    </AppShell>
  );
}
