import type { Metadata } from "next";
import { Badge } from "@mboyo/ui";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { listDisasterEvents } from "../../../lib/admin/events";
import { DisasterEventForm } from "../../../components/admin/DisasterEventForm";
import { DisasterEventStatusToggle } from "../../../components/admin/DisasterEventStatusToggle";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Kejadian Bencana — MBOYO" };

export default async function EventBencanaPage() {
  const supabase = await createServerSupabaseClient();
  const events = await listDisasterEvents(supabase);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-sans text-2xl font-bold text-on-surface">Kejadian Bencana</h1>

      <DisasterEventForm />

      <ul className="flex flex-col gap-2">
        {events.map((event) => (
          <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-brand-border bg-surface-container-lowest p-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-sans text-sm font-semibold text-on-surface">{event.name}</span>
                <Badge tone={event.status === "active" ? "success" : "neutral"}>{event.status === "active" ? "Aktif" : "Selesai"}</Badge>
              </div>
              <span className="font-mono text-xs text-on-surface-variant">
                Mulai {new Date(event.startsAt).toLocaleDateString("id-ID")}
                {event.endsAt ? ` · Selesai ${new Date(event.endsAt).toLocaleDateString("id-ID")}` : ""}
              </span>
            </div>
            <DisasterEventStatusToggle eventId={event.id} status={event.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}
