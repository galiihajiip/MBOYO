import type { Metadata } from "next";
import { getCurrentUser } from "../../../lib/auth/server";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { listNotifications } from "../../../lib/notifications/notifications";
import { NotificationList } from "../../../components/notifications/NotificationList";
import { PushOptIn } from "../../../components/notifications/PushOptIn";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notifikasi — MBOYO" };

export default async function VerifierNotifikasiPage() {
  const user = await getCurrentUser();
  const supabase = await createServerSupabaseClient();
  const notifications = await listNotifications(supabase, {});

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-sans text-2xl font-bold text-on-surface">Notifikasi</h1>
      <PushOptIn />
      <NotificationList
        profileId={user?.profileId ?? ""}
        initialNotifications={notifications}
        role="verifier"
      />
    </div>
  );
}
