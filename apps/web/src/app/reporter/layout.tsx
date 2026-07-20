import { requireRole } from "../../lib/auth/server";
import { AppShell } from "../../components/shell/AppShell";

export const dynamic = "force-dynamic";

export default async function ReporterLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("reporter");

  return (
    <AppShell role="reporter" displayName={user.displayName}>
      {children}
    </AppShell>
  );
}
