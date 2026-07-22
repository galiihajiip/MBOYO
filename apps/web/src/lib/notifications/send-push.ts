import "server-only";
import webpush from "web-push";
import { getServerEnv } from "../env.server";
import type { NotificationsDbClient } from "./types";
import type { PushSubscriptionRow } from "./types";

export interface PushPayload {
  title: string;
  body: string;
  /** Deep-link path opened by the SW's notificationclick handler, e.g. "/verifier/notifikasi". */
  url: string;
}

let vapidConfigured = false;

function ensureVapidConfigured(): boolean {
  const env = getServerEnv();
  if (!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    return false;
  }
  if (!vapidConfigured) {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    vapidConfigured = true;
  }
  return true;
}

/**
 * Sends one Web Push message to every subscription registered for a
 * profile, cleaning up any subscription the push service reports as
 * permanently gone (410 Gone / 404 Not Found — the standard Web Push
 * signal that a subscription is no longer valid, e.g. the user uninstalled
 * the PWA or cleared site data) — this block's explicit "cleanup invalid
 * subscriptions" requirement. Silently does nothing if VAPID isn't
 * configured (NEXT_PUBLIC_VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT
 * all unset), matching this codebase's "the app must work with zero
 * optional-feature configuration" posture (e.g. BLOCK 22's Gemini-unset
 * behavior) — push is enhancement, not a requirement for the rest of the
 * notification system (in-app notifications/realtime still work).
 */
export async function sendPushToProfile(
  db: NotificationsDbClient,
  profileId: string,
  payload: PushPayload,
): Promise<void> {
  if (!ensureVapidConfigured()) {
    return;
  }

  const { data: subscriptions } = await db
    .from("push_subscriptions")
    .select("*")
    .eq("profile_id", profileId)
    .returns<PushSubscriptionRow[]>();

  if (!subscriptions || subscriptions.length === 0) {
    return;
  }

  const body = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: subscription.keys },
          body,
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await db.from("push_subscriptions").delete().eq("id", subscription.id);
        }
        // Any other error (transient network/service issue) is not this
        // notification's problem to solve — the in-app notification row
        // already exists regardless of push delivery outcome.
      }
    }),
  );
}
