import { describe, expect, it, vi, beforeEach } from "vitest";
import { createFakeDb } from "../reports/service/test-support/fake-db";

interface FakeServerEnv {
  NEXT_PUBLIC_VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

const { mockGetServerEnv, setVapidDetailsMock, sendNotificationMock } = vi.hoisted(() => ({
  mockGetServerEnv: vi.fn<() => FakeServerEnv>(),
  setVapidDetailsMock: vi.fn(),
  sendNotificationMock: vi.fn(),
}));

vi.mock("../env.server", () => ({ getServerEnv: () => mockGetServerEnv() }));
vi.mock("web-push", () => ({
  default: { setVapidDetails: setVapidDetailsMock, sendNotification: sendNotificationMock },
}));

import { sendPushToProfile } from "./send-push";

const SUBSCRIPTION_ROW = {
  id: "subscription-1",
  profile_id: "profile-1",
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  keys: { p256dh: "key1", auth: "key2" },
  created_at: "2026-07-24T00:00:00.000Z",
};

describe("sendPushToProfile", () => {
  beforeEach(() => {
    sendNotificationMock.mockReset();
    setVapidDetailsMock.mockReset();
  });

  it("does nothing when VAPID is not configured", async () => {
    mockGetServerEnv.mockReturnValue({});
    const fakeDb = createFakeDb({ from: { push_subscriptions: () => ({ data: [SUBSCRIPTION_ROW], error: null }) } });

    await sendPushToProfile(fakeDb as never, "profile-1", { title: "t", body: "b", url: "/" });

    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it("sends to every subscription for the profile when VAPID is configured", async () => {
    mockGetServerEnv.mockReturnValue({
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public-key",
      VAPID_PRIVATE_KEY: "private-key",
      VAPID_SUBJECT: "mailto:team@example.com",
    });
    sendNotificationMock.mockResolvedValue(undefined);
    const fakeDb = createFakeDb({ from: { push_subscriptions: () => ({ data: [SUBSCRIPTION_ROW], error: null }) } });

    await sendPushToProfile(fakeDb as never, "profile-1", { title: "t", body: "b", url: "/" });

    expect(sendNotificationMock).toHaveBeenCalledTimes(1);
    expect(sendNotificationMock).toHaveBeenCalledWith(
      { endpoint: SUBSCRIPTION_ROW.endpoint, keys: SUBSCRIPTION_ROW.keys },
      JSON.stringify({ title: "t", body: "b", url: "/" }),
    );
  });

  it("does nothing when the profile has no subscriptions", async () => {
    mockGetServerEnv.mockReturnValue({
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public-key",
      VAPID_PRIVATE_KEY: "private-key",
      VAPID_SUBJECT: "mailto:team@example.com",
    });
    const fakeDb = createFakeDb({ from: { push_subscriptions: () => ({ data: [], error: null }) } });

    await sendPushToProfile(fakeDb as never, "profile-1", { title: "t", body: "b", url: "/" });

    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it("cleans up a subscription the push service reports as gone (410)", async () => {
    mockGetServerEnv.mockReturnValue({
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public-key",
      VAPID_PRIVATE_KEY: "private-key",
      VAPID_SUBJECT: "mailto:team@example.com",
    });
    sendNotificationMock.mockRejectedValue(Object.assign(new Error("Gone"), { statusCode: 410 }));

    let deletedId: string | undefined;
    const fakeDb = createFakeDb({
      from: {
        push_subscriptions: () => ({ data: [SUBSCRIPTION_ROW], error: null }),
      },
    });
    const originalFrom = fakeDb.from.bind(fakeDb);
    fakeDb.from = (table: string) => {
      const builder = originalFrom(table);
      const originalEq = builder.eq.bind(builder);
      builder.eq = (...args: unknown[]) => {
        if (args[0] === "id") deletedId = args[1] as string;
        return originalEq(...args);
      };
      return builder;
    };

    await sendPushToProfile(fakeDb as never, "profile-1", { title: "t", body: "b", url: "/" });

    expect(deletedId).toBe("subscription-1");
  });

  it("does not throw on a transient (non-410/404) push delivery error", async () => {
    mockGetServerEnv.mockReturnValue({
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public-key",
      VAPID_PRIVATE_KEY: "private-key",
      VAPID_SUBJECT: "mailto:team@example.com",
    });
    sendNotificationMock.mockRejectedValue(Object.assign(new Error("Server error"), { statusCode: 500 }));

    const fakeDb = createFakeDb({ from: { push_subscriptions: () => ({ data: [SUBSCRIPTION_ROW], error: null }) } });

    await expect(
      sendPushToProfile(fakeDb as never, "profile-1", { title: "t", body: "b", url: "/" }),
    ).resolves.toBeUndefined();
  });
});
