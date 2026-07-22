// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PushOptIn } from "./PushOptIn";

vi.mock("../../lib/env.client", () => ({
  getClientEnv: vi.fn(),
}));

import { getClientEnv } from "../../lib/env.client";

// A syntactically valid base64url string — the real VAPID key is
// base64url-decoded via atob() before being used, so an arbitrary
// non-base64 placeholder (e.g. "vapid-key") throws "Invalid character" and
// gets swallowed by the component's catch-all error handling.
const VALID_VAPID_KEY = "dGVzdC12YXBpZC1wdWJsaWMta2V5LTEyMzQ1Njc4OTA";

const BANNER_TEXT =
  "Aktifkan notifikasi push untuk mendapat peringatan eskalasi penting secara langsung, bahkan saat MBOYO tidak dibuka. Anda dapat menonaktifkannya kapan saja.";

interface MockSubscription {
  endpoint: string;
  unsubscribe: ReturnType<typeof vi.fn>;
  toJSON: () => { endpoint: string; keys?: { p256dh: string; auth: string } };
}

function makeSubscription(overrides: Partial<MockSubscription> = {}): MockSubscription {
  return {
    endpoint: "https://push.example/abc",
    unsubscribe: vi.fn().mockResolvedValue(true),
    toJSON: () => ({ endpoint: "https://push.example/abc", keys: { p256dh: "p256dh-key", auth: "auth-key" } }),
    ...overrides,
  };
}

function stubServiceWorker(options: {
  existingSubscription?: MockSubscription | null;
  subscribeResult?: MockSubscription;
}) {
  const getSubscription = vi.fn().mockResolvedValue(options.existingSubscription ?? null);
  const subscribe = vi.fn().mockResolvedValue(options.subscribeResult ?? makeSubscription());
  const pushManager = { getSubscription, subscribe };
  const registration = { pushManager };

  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve(registration) },
  });

  return { getSubscription, subscribe, pushManager, registration };
}

function stubNotification(permission: NotificationPermission, requestPermissionResult?: NotificationPermission) {
  const requestPermission = vi.fn().mockResolvedValue(requestPermissionResult ?? permission);
  vi.stubGlobal("Notification", { permission, requestPermission });
}

describe("PushOptIn", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // @ts-expect-error -- test cleanup of a property we defined via defineProperty
    delete navigator.serviceWorker;
    localStorage.clear();
    vi.mocked(getClientEnv).mockReset();
  });

  it("renders nothing when push notifications aren't supported (no serviceWorker)", async () => {
    stubNotification("default");
    // @ts-expect-error -- simulate absence of serviceWorker support
    delete navigator.serviceWorker;
    render(<PushOptIn />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();
  });

  it("renders the subscribed state when an existing push subscription is found", async () => {
    stubNotification("granted");
    stubServiceWorker({ existingSubscription: makeSubscription() });
    vi.mocked(getClientEnv).mockReturnValue({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: VALID_VAPID_KEY } as ReturnType<typeof getClientEnv>);

    render(<PushOptIn />);
    expect(await screen.findByText("Notifikasi push telah diaktifkan pada perangkat ini.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nonaktifkan" })).toBeInTheDocument();
  });

  it("renders nothing when Notification.permission is already granted (no existing subscription)", async () => {
    stubNotification("granted");
    stubServiceWorker({ existingSubscription: null });
    vi.mocked(getClientEnv).mockReturnValue({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: VALID_VAPID_KEY } as ReturnType<typeof getClientEnv>);

    render(<PushOptIn />);
    await waitFor(() => expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument());
  });

  it("renders nothing when Notification.permission is denied", async () => {
    stubNotification("denied");
    stubServiceWorker({ existingSubscription: null });
    vi.mocked(getClientEnv).mockReturnValue({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: VALID_VAPID_KEY } as ReturnType<typeof getClientEnv>);

    render(<PushOptIn />);
    await waitFor(() => expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument());
  });

  it("renders nothing when the user already dismissed the banner this browser", async () => {
    localStorage.setItem("mboyo-push-optin-dismissed", "true");
    stubNotification("default");
    stubServiceWorker({ existingSubscription: null });
    vi.mocked(getClientEnv).mockReturnValue({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: VALID_VAPID_KEY } as ReturnType<typeof getClientEnv>);

    render(<PushOptIn />);
    await waitFor(() => expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument());
  });

  it("renders nothing when VAPID isn't configured", async () => {
    stubNotification("default");
    stubServiceWorker({ existingSubscription: null });
    vi.mocked(getClientEnv).mockReturnValue({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: undefined } as ReturnType<typeof getClientEnv>);

    render(<PushOptIn />);
    await waitFor(() => expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument());
  });

  it("renders nothing when getClientEnv throws (invalid client env config)", async () => {
    stubNotification("default");
    stubServiceWorker({ existingSubscription: null });
    vi.mocked(getClientEnv).mockImplementation(() => {
      throw new Error("Invalid client environment configuration");
    });

    render(<PushOptIn />);
    await waitFor(() => expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument());
  });

  it("shows the education banner when supported, default permission, VAPID configured, and not dismissed", async () => {
    stubNotification("default");
    stubServiceWorker({ existingSubscription: null });
    vi.mocked(getClientEnv).mockReturnValue({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: VALID_VAPID_KEY } as ReturnType<typeof getClientEnv>);

    render(<PushOptIn />);
    expect(await screen.findByText(BANNER_TEXT)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nanti" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aktifkan" })).toBeInTheDocument();
  });

  it("never calls Notification.requestPermission on mount", async () => {
    const { requestPermission } = (() => {
      const requestPermission = vi.fn().mockResolvedValue("granted");
      vi.stubGlobal("Notification", { permission: "default", requestPermission });
      return { requestPermission };
    })();
    stubServiceWorker({ existingSubscription: null });
    vi.mocked(getClientEnv).mockReturnValue({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: VALID_VAPID_KEY } as ReturnType<typeof getClientEnv>);

    render(<PushOptIn />);
    await screen.findByText(BANNER_TEXT);
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("dismissing via 'Nanti' hides the banner and persists the dismissal to localStorage", async () => {
    const user = userEvent.setup();
    stubNotification("default");
    stubServiceWorker({ existingSubscription: null });
    vi.mocked(getClientEnv).mockReturnValue({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: VALID_VAPID_KEY } as ReturnType<typeof getClientEnv>);

    render(<PushOptIn />);
    await screen.findByText(BANNER_TEXT);
    await user.click(screen.getByRole("button", { name: "Nanti" }));

    expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument();
    expect(localStorage.getItem("mboyo-push-optin-dismissed")).toBe("true");
  });

  it("clicking 'Aktifkan' requests permission, subscribes, posts to the API, and shows the subscribed state", async () => {
    const user = userEvent.setup();
    stubNotification("default", "granted");
    const subscription = makeSubscription();
    const { subscribe } = stubServiceWorker({ existingSubscription: null, subscribeResult: subscription });
    vi.mocked(getClientEnv).mockReturnValue({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: VALID_VAPID_KEY } as ReturnType<typeof getClientEnv>);
    const fetchMock = vi.fn().mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true, data: {} }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<PushOptIn />);
    await screen.findByText(BANNER_TEXT);
    await user.click(screen.getByRole("button", { name: "Aktifkan" }));

    expect(await screen.findByText("Notifikasi push telah diaktifkan pada perangkat ini.")).toBeInTheDocument();
    const expectedApplicationServerKey: unknown = expect.any(Uint8Array);
    expect(subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true, applicationServerKey: expectedApplicationServerKey }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/push-subscriptions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ endpoint: "https://push.example/abc", keys: { p256dh: "p256dh-key", auth: "auth-key" } }),
      }),
    );
    expect(localStorage.getItem("mboyo-push-optin-dismissed")).toBe("true");
  });

  it("clicking 'Aktifkan' dismisses (without subscribing) when the user denies permission", async () => {
    const user = userEvent.setup();
    stubNotification("default", "denied");
    const { subscribe } = stubServiceWorker({ existingSubscription: null });
    vi.mocked(getClientEnv).mockReturnValue({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: VALID_VAPID_KEY } as ReturnType<typeof getClientEnv>);

    render(<PushOptIn />);
    await screen.findByText(BANNER_TEXT);
    await user.click(screen.getByRole("button", { name: "Aktifkan" }));

    await waitFor(() => expect(screen.queryByText(BANNER_TEXT)).not.toBeInTheDocument());
    expect(subscribe).not.toHaveBeenCalled();
    expect(localStorage.getItem("mboyo-push-optin-dismissed")).toBe("true");
  });

  it("shows an error message when the subscribe API call returns ok:false", async () => {
    const user = userEvent.setup();
    stubNotification("default", "granted");
    stubServiceWorker({ existingSubscription: null, subscribeResult: makeSubscription() });
    vi.mocked(getClientEnv).mockReturnValue({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: VALID_VAPID_KEY } as ReturnType<typeof getClientEnv>);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({ json: () => Promise.resolve({ ok: false, error: { message: "Gagal mendaftarkan langganan." } }) }),
    );

    render(<PushOptIn />);
    await screen.findByText(BANNER_TEXT);
    await user.click(screen.getByRole("button", { name: "Aktifkan" }));

    expect(await screen.findByText("Gagal mendaftarkan langganan.")).toBeInTheDocument();
  });

  it("shows a generic error message when subscribing throws (e.g. browser gives no keys)", async () => {
    const user = userEvent.setup();
    stubNotification("default", "granted");
    stubServiceWorker({
      existingSubscription: null,
      subscribeResult: makeSubscription({ toJSON: () => ({ endpoint: "https://push.example/abc" }) }),
    });
    vi.mocked(getClientEnv).mockReturnValue({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: VALID_VAPID_KEY } as ReturnType<typeof getClientEnv>);

    render(<PushOptIn />);
    await screen.findByText(BANNER_TEXT);
    await user.click(screen.getByRole("button", { name: "Aktifkan" }));

    expect(await screen.findByText("Gagal mengaktifkan notifikasi push pada perangkat ini.")).toBeInTheDocument();
  });

  it("unsubscribing calls unsubscribe(), deletes the server-side record, and returns to the banner-eligible state", async () => {
    const user = userEvent.setup();
    stubNotification("granted");
    const subscription = makeSubscription();
    stubServiceWorker({ existingSubscription: subscription });
    vi.mocked(getClientEnv).mockReturnValue({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: VALID_VAPID_KEY } as ReturnType<typeof getClientEnv>);
    const fetchMock = vi.fn().mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<PushOptIn />);
    await screen.findByText("Notifikasi push telah diaktifkan pada perangkat ini.");
    await user.click(screen.getByRole("button", { name: "Nonaktifkan" }));

    await waitFor(() => expect(screen.queryByText("Notifikasi push telah diaktifkan pada perangkat ini.")).not.toBeInTheDocument());
    expect(subscription.unsubscribe).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/push-subscriptions",
      expect.objectContaining({ method: "DELETE", body: JSON.stringify({ endpoint: "https://push.example/abc" }) }),
    );
  });

  it("shows an error message when unsubscribe() itself throws", async () => {
    const user = userEvent.setup();
    stubNotification("granted");
    const subscription = makeSubscription({ unsubscribe: vi.fn().mockRejectedValue(new Error("boom")) });
    stubServiceWorker({ existingSubscription: subscription });
    vi.mocked(getClientEnv).mockReturnValue({ NEXT_PUBLIC_VAPID_PUBLIC_KEY: VALID_VAPID_KEY } as ReturnType<typeof getClientEnv>);

    render(<PushOptIn />);
    await screen.findByText("Notifikasi push telah diaktifkan pada perangkat ini.");
    await user.click(screen.getByRole("button", { name: "Nonaktifkan" }));

    expect(await screen.findByText("Gagal menonaktifkan notifikasi push pada perangkat ini.")).toBeInTheDocument();
    // Still shows the subscribed state since the unsubscribe failed.
    expect(screen.getByText("Notifikasi push telah diaktifkan pada perangkat ini.")).toBeInTheDocument();
  });
});
