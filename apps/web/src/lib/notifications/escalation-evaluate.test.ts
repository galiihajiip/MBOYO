import { describe, expect, it, vi } from "vitest";
import { createFakeDb } from "../reports/service/test-support/fake-db";

const { sendPushToProfileMock } = vi.hoisted(() => ({ sendPushToProfileMock: vi.fn().mockResolvedValue(undefined) }));

vi.mock("./send-push", () => ({ sendPushToProfile: sendPushToProfileMock }));

import { evaluateEscalations } from "./escalation-evaluate";

describe("evaluateEscalations", () => {
  it("returns 0 and does not query for new notifications when nothing was raised", async () => {
    const fakeDb = createFakeDb({ rpc: { evaluate_escalations: () => ({ data: 0, error: null }) } });

    const result = await evaluateEscalations(fakeDb as never, "org-1");
    expect(result).toBe(0);
    expect(sendPushToProfileMock).not.toHaveBeenCalled();
  });

  it("pushes to every newly-raised notification's recipient, using the resolved role's notifikasi path", async () => {
    sendPushToProfileMock.mockClear();
    const fakeDb = createFakeDb({
      rpc: { evaluate_escalations: () => ({ data: 1, error: null }) },
      from: {
        notifications: () => ({
          data: [
            {
              id: "notification-1",
              recipient_profile_id: "profile-1",
              type: "task_overdue",
              level: "warning",
              payload: {},
              dedup_key: "task_overdue:task-1",
              read_at: null,
              created_at: "2026-07-24T00:00:00.000Z",
            },
          ],
          error: null,
        }),
        role_assignments: () => ({ data: [{ profile_id: "profile-1", role: "response_coordinator" }], error: null }),
      },
    });

    await evaluateEscalations(fakeDb as never, "org-1");

    expect(sendPushToProfileMock).toHaveBeenCalledWith(
      fakeDb,
      "profile-1",
      expect.objectContaining({ url: "/command/notifikasi" }),
    );
  });

  it("maps a 42501 error to ApiError('forbidden')", async () => {
    const fakeDb = createFakeDb({
      rpc: { evaluate_escalations: () => ({ data: null, error: { code: "42501", message: "no role" } }) },
    });

    await expect(evaluateEscalations(fakeDb as never, "org-1")).rejects.toMatchObject({ code: "forbidden" });
  });

  it("throws ApiError('internal_error') on an unrecognized error", async () => {
    const fakeDb = createFakeDb({
      rpc: { evaluate_escalations: () => ({ data: null, error: { message: "connection reset" } }) },
    });

    await expect(evaluateEscalations(fakeDb as never, "org-1")).rejects.toMatchObject({ code: "internal_error" });
  });
});
