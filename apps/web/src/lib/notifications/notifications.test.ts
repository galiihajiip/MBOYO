import { describe, expect, it } from "vitest";
import { createFakeDb } from "../reports/service/test-support/fake-db";
import { ApiError } from "../api/errors";
import { countUnreadNotifications, listNotifications, markNotificationRead } from "./notifications";

const NOTIFICATION_ROW = {
  id: "notification-1",
  recipient_profile_id: "profile-1",
  type: "verifier_sla_breach",
  level: "warning" as const,
  payload: { reportId: "report-1" },
  dedup_key: "verifier_sla_breach:report-1",
  read_at: null,
  created_at: "2026-07-24T00:00:00.000Z",
};

describe("listNotifications", () => {
  it("returns notification DTOs", async () => {
    const fakeDb = createFakeDb({ from: { notifications: () => ({ data: [NOTIFICATION_ROW], error: null }) } });

    const result = await listNotifications(fakeDb as never, {});
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("verifier_sla_breach");
  });

  it("applies unreadOnly as an is(read_at, null) filter", async () => {
    let capturedBuilder: { calls: Array<{ method: string; args: unknown[] }> } | undefined;
    const fakeDb = createFakeDb({ from: { notifications: () => ({ data: [], error: null }) } });
    const originalFrom = fakeDb.from.bind(fakeDb);
    fakeDb.from = (table: string) => {
      const builder = originalFrom(table);
      capturedBuilder = builder;
      return builder;
    };

    await listNotifications(fakeDb as never, { unreadOnly: true });

    expect(capturedBuilder?.calls.find((c) => c.method === "is")?.args).toEqual(["read_at", null]);
  });

  it("throws ApiError('internal_error') on a query error", async () => {
    const fakeDb = createFakeDb({ from: { notifications: () => ({ data: null, error: { message: "connection reset" } }) } });

    await expect(listNotifications(fakeDb as never, {})).rejects.toMatchObject({ code: "internal_error" });
  });
});

describe("countUnreadNotifications", () => {
  it("returns the count", async () => {
    const fakeDb = createFakeDb({ from: { notifications: () => ({ data: null, error: null, count: 3 }) } });

    const result = await countUnreadNotifications(fakeDb as never);
    expect(result).toBe(3);
  });

  it("returns 0 when count is null", async () => {
    const fakeDb = createFakeDb({ from: { notifications: () => ({ data: null, error: null, count: null }) } });

    const result = await countUnreadNotifications(fakeDb as never);
    expect(result).toBe(0);
  });
});

describe("markNotificationRead", () => {
  it("returns the updated notification DTO on success", async () => {
    const fakeDb = createFakeDb({
      rpc: { mark_notification_read: () => ({ data: { ...NOTIFICATION_ROW, read_at: "2026-07-24T01:00:00.000Z" }, error: null }) },
    });

    const result = await markNotificationRead(fakeDb as never, "notification-1");
    expect(result.readAt).toBe("2026-07-24T01:00:00.000Z");
  });

  it("maps a P0002 (not found) error to ApiError('not_found')", async () => {
    const fakeDb = createFakeDb({
      rpc: { mark_notification_read: () => ({ data: null, error: { code: "P0002", message: "not found" } }) },
    });

    await expect(markNotificationRead(fakeDb as never, "missing")).rejects.toMatchObject({ code: "not_found" });
  });

  it("throws ApiError('internal_error') on an unrecognized error", async () => {
    const fakeDb = createFakeDb({
      rpc: { mark_notification_read: () => ({ data: null, error: { message: "connection reset" } }) },
    });

    await expect(markNotificationRead(fakeDb as never, "notification-1")).rejects.toBeInstanceOf(ApiError);
  });
});
