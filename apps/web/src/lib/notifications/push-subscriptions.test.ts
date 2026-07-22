import { describe, expect, it } from "vitest";
import { createFakeDb } from "../reports/service/test-support/fake-db";
import { createPushSubscription, deletePushSubscription, listPushSubscriptions } from "./push-subscriptions";

const SUBSCRIPTION_ROW = {
  id: "subscription-1",
  profile_id: "profile-1",
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  keys: { p256dh: "key1", auth: "key2" },
  created_at: "2026-07-24T00:00:00.000Z",
};

describe("createPushSubscription", () => {
  it("returns the subscription DTO on success", async () => {
    const fakeDb = createFakeDb({ from: { push_subscriptions: () => ({ data: SUBSCRIPTION_ROW, error: null }) } });

    const result = await createPushSubscription(fakeDb as never, "profile-1", {
      endpoint: SUBSCRIPTION_ROW.endpoint,
      keys: SUBSCRIPTION_ROW.keys,
    });
    expect(result.endpoint).toBe(SUBSCRIPTION_ROW.endpoint);
  });

  it("throws ApiError('internal_error') on a query error", async () => {
    const fakeDb = createFakeDb({
      from: { push_subscriptions: () => ({ data: null, error: { message: "connection reset" } }) },
    });

    await expect(
      createPushSubscription(fakeDb as never, "profile-1", { endpoint: "https://example.com/push", keys: { p256dh: "a", auth: "b" } }),
    ).rejects.toMatchObject({ code: "internal_error" });
  });
});

describe("deletePushSubscription", () => {
  it("resolves without error on success", async () => {
    const fakeDb = createFakeDb({ from: { push_subscriptions: () => ({ data: null, error: null }) } });

    await expect(deletePushSubscription(fakeDb as never, SUBSCRIPTION_ROW.endpoint)).resolves.toBeUndefined();
  });

  it("throws ApiError('internal_error') on a query error", async () => {
    const fakeDb = createFakeDb({
      from: { push_subscriptions: () => ({ data: null, error: { message: "connection reset" } }) },
    });

    await expect(deletePushSubscription(fakeDb as never, SUBSCRIPTION_ROW.endpoint)).rejects.toMatchObject({
      code: "internal_error",
    });
  });
});

describe("listPushSubscriptions", () => {
  it("returns subscription DTOs", async () => {
    const fakeDb = createFakeDb({ from: { push_subscriptions: () => ({ data: [SUBSCRIPTION_ROW], error: null }) } });

    const result = await listPushSubscriptions(fakeDb as never);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("subscription-1");
  });
});
