import { describe, expect, it } from "vitest";
import { createFakeDb } from "../reports/service/test-support/fake-db";
import { createDisasterEvent, listDisasterEvents, updateDisasterEvent } from "./events";

const EVENT_ROW = {
  id: "event-1",
  organization_id: "org-1",
  name: "Gempa Cianjur",
  status: "active" as const,
  starts_at: "2026-07-26T00:00:00.000Z",
  ends_at: null,
};

describe("listDisasterEvents", () => {
  it("returns disaster event DTOs", async () => {
    const fakeDb = createFakeDb({ from: { disaster_events: () => ({ data: [EVENT_ROW], error: null }) } });

    const result = await listDisasterEvents(fakeDb as never);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Gempa Cianjur");
  });

  it("throws ApiError('internal_error') on a query error", async () => {
    const fakeDb = createFakeDb({
      from: { disaster_events: () => ({ data: null, error: { message: "connection reset" } }) },
    });

    await expect(listDisasterEvents(fakeDb as never)).rejects.toMatchObject({ code: "internal_error" });
  });
});

describe("createDisasterEvent", () => {
  it("returns the created event DTO on success", async () => {
    const fakeDb = createFakeDb({ rpc: { create_disaster_event: () => ({ data: EVENT_ROW, error: null }) } });

    const result = await createDisasterEvent(fakeDb as never, { name: "Gempa Cianjur" });
    expect(result.id).toBe("event-1");
  });

  it("maps a 22023 error to ApiError('validation_failed')", async () => {
    const fakeDb = createFakeDb({
      rpc: { create_disaster_event: () => ({ data: null, error: { code: "22023", message: "name is required" } }) },
    });

    await expect(createDisasterEvent(fakeDb as never, { name: "x" })).rejects.toMatchObject({
      code: "validation_failed",
    });
  });
});

describe("updateDisasterEvent", () => {
  it("returns the updated event DTO on success", async () => {
    const fakeDb = createFakeDb({
      rpc: { update_disaster_event: () => ({ data: { ...EVENT_ROW, status: "closed" }, error: null }) },
    });

    const result = await updateDisasterEvent(fakeDb as never, "event-1", { status: "closed" });
    expect(result.status).toBe("closed");
  });

  it("maps a P0002 error to ApiError('not_found')", async () => {
    const fakeDb = createFakeDb({
      rpc: { update_disaster_event: () => ({ data: null, error: { code: "P0002", message: "not found" } }) },
    });

    await expect(updateDisasterEvent(fakeDb as never, "missing", {})).rejects.toMatchObject({ code: "not_found" });
  });
});
