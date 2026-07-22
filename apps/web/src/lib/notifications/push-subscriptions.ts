import "server-only";
import type { CreatePushSubscriptionInput } from "@mboyo/domain";
import { ApiError } from "../api/errors";
import { toPushSubscriptionDto, type NotificationsDbClient, type PushSubscriptionDto, type PushSubscriptionRow } from "./types";

/**
 * Registers (or re-registers) a Web Push subscription for the calling
 * profile — push_subscriptions_insert_own RLS is the authorization
 * boundary (own profile_id only); this function resolves the caller's own
 * profile id server-side (never trusts a client-passed one) and upserts on
 * the existing (profile_id, endpoint) unique index so a browser
 * re-subscribing with the same endpoint (e.g. after a keys rotation is NOT
 * involved — browsers keep the same endpoint across most subscription
 * refreshes) never produces a duplicate row.
 */
export async function createPushSubscription(
  db: NotificationsDbClient,
  profileId: string,
  input: CreatePushSubscriptionInput,
): Promise<PushSubscriptionDto> {
  const { data, error } = await db
    .from("push_subscriptions")
    .upsert(
      { profile_id: profileId, endpoint: input.endpoint, keys: input.keys },
      { onConflict: "profile_id,endpoint" },
    )
    .select("*")
    .single<PushSubscriptionRow>();

  if (error || !data) {
    throw new ApiError("internal_error", "Gagal menyimpan langganan notifikasi push.");
  }

  return toPushSubscriptionDto(data);
}

/**
 * Removes a subscription by endpoint — push_subscriptions_delete_own RLS
 * scopes this to the caller's own rows, so a mismatched/foreign endpoint
 * simply deletes nothing (not an error) rather than needing an explicit
 * ownership check here.
 */
export async function deletePushSubscription(db: NotificationsDbClient, endpoint: string): Promise<void> {
  const { error } = await db.from("push_subscriptions").delete().eq("endpoint", endpoint);

  if (error) {
    throw new ApiError("internal_error", "Gagal menghapus langganan notifikasi push.");
  }
}

/** Lists the caller's own registered push subscriptions — for the unsubscribe/manage-devices UI. */
export async function listPushSubscriptions(db: NotificationsDbClient): Promise<PushSubscriptionDto[]> {
  const { data, error } = await db.from("push_subscriptions").select("*").returns<PushSubscriptionRow[]>();

  if (error) {
    throw new ApiError("internal_error", "Gagal memuat daftar langganan notifikasi push.");
  }

  return (data ?? []).map(toPushSubscriptionDto);
}
