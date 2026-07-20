/**
 * ⚠️ TEMPORARY — placeholder disaster_event list ⚠️
 *
 * Real events must come from a live `disaster_events` query (RLS-scoped
 * per docs/product/RBAC_MATRIX.md, seeded in supabase/seed.sql). This
 * hardcoded list exists only so the wizard's Event step has something to
 * select from before that data-fetching wire-up lands. Delete once a real
 * events query replaces it.
 */
export interface MockEvent {
  id: string;
  name: string;
}

export const MOCK_ACTIVE_EVENTS: MockEvent[] = [
  { id: "00000000-0000-0000-0000-0000000000e1", name: "Banjir Jakarta Selatan — Demo" },
];
