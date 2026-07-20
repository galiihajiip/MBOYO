import { RadioCard } from "@mboyo/ui";
import { MOCK_ACTIVE_EVENTS } from "../../../../../lib/reports/mock-events";
import type { ReportDraft } from "../../../../../lib/reports/types";

export interface EventStepProps {
  draft: ReportDraft;
  setDraft: (updater: (current: ReportDraft) => ReportDraft) => void;
}

/**
 * Step 1 — Event. Real event list must come from a live disaster_events
 * query (RLS-scoped); MOCK_ACTIVE_EVENTS is a temporary placeholder (see
 * lib/reports/mock-events.ts) since that data-fetching wire-up is out of
 * this block's scope.
 */
export function EventStep({ draft, setDraft }: EventStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="font-sans text-sm text-on-surface-variant">
        Pilih kejadian bencana yang sesuai dengan laporan Anda.
      </p>
      <div className="flex flex-col gap-3" role="radiogroup" aria-label="Pilih event bencana">
        {MOCK_ACTIVE_EVENTS.map((event) => (
          <RadioCard
            key={event.id}
            id={`event-${event.id}`}
            name="event"
            value={event.id}
            checked={draft.eventId === event.id}
            onChange={() =>
              setDraft((current) => ({ ...current, eventId: event.id, eventName: event.name }))
            }
            label={event.name}
          />
        ))}
      </div>
    </div>
  );
}
