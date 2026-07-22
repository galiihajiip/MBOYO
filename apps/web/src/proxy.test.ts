import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { isSameOriginRequest } from "./proxy";

function requestWithHeaders(url: string, headers: Record<string, string>): NextRequest {
  return new NextRequest(url, { headers });
}

describe("isSameOriginRequest", () => {
  it("allows a request whose Origin header matches the request's own origin", () => {
    const request = requestWithHeaders("http://localhost:3000/api/reports", {
      origin: "http://localhost:3000",
    });
    expect(isSameOriginRequest(request)).toBe(true);
  });

  it("denies a request whose Origin header is a different origin", () => {
    const request = requestWithHeaders("http://localhost:3000/api/reports", {
      origin: "https://evil.example.com",
    });
    expect(isSameOriginRequest(request)).toBe(false);
  });

  it("falls back to Referer when Origin is absent", () => {
    const request = requestWithHeaders("http://localhost:3000/api/reports", {
      referer: "http://localhost:3000/reporter/laporan/baru",
    });
    expect(isSameOriginRequest(request)).toBe(true);
  });

  it("denies when neither Origin nor Referer is present (fails closed)", () => {
    const request = requestWithHeaders("http://localhost:3000/api/reports", {});
    expect(isSameOriginRequest(request)).toBe(false);
  });

  it("denies a malformed Origin header rather than throwing", () => {
    const request = requestWithHeaders("http://localhost:3000/api/reports", {
      origin: "not a valid url",
    });
    expect(isSameOriginRequest(request)).toBe(false);
  });
});
