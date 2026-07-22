"use client";

import { useEffect, useState } from "react";
import { Button } from "@mboyo/ui";
import { getClientEnv } from "../../lib/env.client";

const DISMISSED_STORAGE_KEY = "mboyo-push-optin-dismissed";

function base64UrlToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

/**
 * Web Push opt-in (BLOCK 25) — this block's explicit "education before
 * permission, no repeated nagging" requirement: shows an explanatory
 * banner FIRST (never calls Notification.requestPermission() on mount or
 * silently), only requests the native browser permission after the user
 * explicitly clicks "Aktifkan," and remembers a dismissal via
 * localStorage exactly like InstallPrompt.tsx's established pattern — a
 * dismissed banner never reappears on subsequent navigations within the
 * same browser.
 *
 * Renders nothing if: push isn't supported at all (no PushManager/
 * ServiceWorkerRegistration.showNotification), VAPID isn't configured
 * (NEXT_PUBLIC_VAPID_PUBLIC_KEY unset — matches this codebase's "the app
 * works with zero optional-feature configuration" posture), permission is
 * already granted or permanently denied (nothing left to ask), or the user
 * already dismissed it this browser.
 */
export function PushOptIn() {
  const [visible, setVisible] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
      setCheckingExisting(false);
      return;
    }

    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((existingSubscription) => {
        if (existingSubscription) {
          setSubscribed(true);
          return;
        }

        if (Notification.permission !== "default") return;
        if (localStorage.getItem(DISMISSED_STORAGE_KEY) === "true") return;

        let vapidPublicKey: string | undefined;
        try {
          vapidPublicKey = getClientEnv().NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        } catch {
          return;
        }
        if (!vapidPublicKey) return;

        setVisible(true);
      })
      .finally(() => setCheckingExisting(false));
  }, []);

  async function handleUnsubscribe() {
    setIsSubscribing(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        const endpoint = existingSubscription.endpoint;
        await existingSubscription.unsubscribe();
        await fetch("/api/push-subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        }).catch(() => {
          // The browser-side unsubscribe already succeeded (no more pushes
          // will arrive on this device); a failed server-side row cleanup
          // is not worth blocking the user's unsubscribe action on.
        });
      }
      setSubscribed(false);
    } catch {
      setError("Gagal menonaktifkan notifikasi push pada perangkat ini.");
    } finally {
      setIsSubscribing(false);
    }
  }

  function dismiss() {
    setVisible(false);
    localStorage.setItem(DISMISSED_STORAGE_KEY, "true");
  }

  async function handleEnable() {
    setIsSubscribing(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        dismiss();
        return;
      }

      const vapidPublicKey = getClientEnv().NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        dismiss();
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(vapidPublicKey),
      });

      const subscriptionJson = subscription.toJSON() as { endpoint: string; keys?: { p256dh: string; auth: string } };
      if (!subscriptionJson.keys) {
        throw new Error("Browser tidak menyediakan kunci langganan push.");
      }

      const response = await fetch("/api/push-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscriptionJson.endpoint, keys: subscriptionJson.keys }),
      });
      const body = (await response.json()) as { ok: boolean; error?: { message: string } };
      if (!body.ok) {
        setError(body.error?.message ?? "Gagal mengaktifkan notifikasi push.");
        return;
      }

      setSubscribed(true);
      localStorage.setItem(DISMISSED_STORAGE_KEY, "true");
    } catch {
      setError("Gagal mengaktifkan notifikasi push pada perangkat ini.");
    } finally {
      setIsSubscribing(false);
    }
  }

  if (checkingExisting) return null;

  if (subscribed) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-brand-safe-green bg-brand-safe-green/5 p-3">
        <p className="font-sans text-sm text-on-surface">Notifikasi push telah diaktifkan pada perangkat ini.</p>
        <Button variant="ghost" onClick={() => void handleUnsubscribe()} disabled={isSubscribing}>
          {isSubscribing ? "Menonaktifkan..." : "Nonaktifkan"}
        </Button>
        {error ? <p className="w-full font-sans text-xs text-brand-critical-red">{error}</p> : null}
      </div>
    );
  }

  if (!visible) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-brand-border bg-surface-container-lowest p-4">
      <p className="font-sans text-sm text-on-surface">
        Aktifkan notifikasi push untuk mendapat peringatan eskalasi penting secara langsung, bahkan saat MBOYO tidak
        dibuka. Anda dapat menonaktifkannya kapan saja.
      </p>
      <div className="flex shrink-0 gap-2">
        <Button variant="ghost" onClick={dismiss} disabled={isSubscribing}>
          Nanti
        </Button>
        <Button onClick={() => void handleEnable()} disabled={isSubscribing}>
          {isSubscribing ? "Mengaktifkan..." : "Aktifkan"}
        </Button>
      </div>
      {error ? <p className="w-full font-sans text-xs text-brand-critical-red">{error}</p> : null}
    </div>
  );
}
