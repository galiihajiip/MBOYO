"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "../../lib/supabase/browser";

export interface RealtimeNotificationRow {
  id: string;
  recipient_profile_id: string;
  type: string;
  level: "info" | "warning" | "high" | "critical";
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

/**
 * Subscribes to Postgres Changes on public.notifications for the caller's
 * own profile, via the realtime publication BLOCK 08 already added this
 * table to (supabase/migrations/20260716153714_realtime_publication.sql)
 * — this hook is the first Realtime subscription anywhere in this
 * codebase (confirmed by research: zero prior `.channel()` call sites),
 * so it establishes the pattern rather than reusing one.
 *
 * RLS still applies to Realtime — a Postgres Changes subscription only
 * ever delivers rows the subscribing role could otherwise SELECT
 * (notifications_select_own), so filtering by recipient_profile_id here is
 * a server-side Realtime filter for efficiency, not the security boundary.
 */
export function useRealtimeNotifications(profileId: string | null, onInsert: (row: RealtimeNotificationRow) => void) {
  const onInsertRef = useRef(onInsert);
  onInsertRef.current = onInsert;

  useEffect(() => {
    if (!profileId) return;

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`notifications:${profileId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_profile_id=eq.${profileId}` },
        (payload) => {
          onInsertRef.current(payload.new as RealtimeNotificationRow);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profileId]);
}

/** Convenience wrapper maintaining an in-memory unread count, incremented on every realtime INSERT and reset from an initial server-fetched value. */
export function useUnreadNotificationCount(profileId: string | null, initialCount: number): number {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  useRealtimeNotifications(profileId, () => {
    setCount((current) => current + 1);
  });

  return count;
}
