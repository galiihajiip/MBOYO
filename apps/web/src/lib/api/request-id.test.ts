import { describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { resolveRequestId } from "./request-id";

function makeRequest(headerValue: string | null): NextRequest {
  return {
    headers: {
      get: (name: string) => (name === "x-request-id" ? headerValue : null),
    },
  } as unknown as NextRequest;
}

describe("resolveRequestId", () => {
  it("echoes an inbound x-request-id header when present", () => {
    const request = makeRequest("upstream-request-id-123");
    expect(resolveRequestId(request)).toBe("upstream-request-id-123");
  });

  it("mints a fresh UUID via crypto.randomUUID when the header is absent", () => {
    const mintedId = "11111111-1111-4111-8111-111111111111";
    const randomUUIDSpy = vi.spyOn(crypto, "randomUUID").mockReturnValue(mintedId);

    const request = makeRequest(null);
    expect(resolveRequestId(request)).toBe(mintedId);
    expect(randomUUIDSpy).toHaveBeenCalledTimes(1);

    randomUUIDSpy.mockRestore();
  });

  it("mints a valid v4-shaped UUID when not mocked", () => {
    const request = makeRequest(null);
    const id = resolveRequestId(request);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});
