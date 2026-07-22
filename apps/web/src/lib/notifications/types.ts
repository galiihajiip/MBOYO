import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationLevel } from "@mboyo/domain";

/** Same "explicit client argument, directly unit-testable" convention as lib/reports/service/types.ts and lib/command/types.ts. */
export type NotificationsDbClient = SupabaseClient;

export interface NotificationRow {
  id: string;
  recipient_profile_id: string;
  type: string;
  level: NotificationLevel;
  payload: Record<string, unknown>;
  dedup_key: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationDto {
  id: string;
  type: string;
  level: NotificationLevel;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export function toNotificationDto(row: NotificationRow): NotificationDto {
  return {
    id: row.id,
    type: row.type,
    level: row.level,
    payload: row.payload,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export interface PushSubscriptionRow {
  id: string;
  profile_id: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  created_at: string;
}

export interface PushSubscriptionDto {
  id: string;
  endpoint: string;
  createdAt: string;
}

export function toPushSubscriptionDto(row: PushSubscriptionRow): PushSubscriptionDto {
  return { id: row.id, endpoint: row.endpoint, createdAt: row.created_at };
}
