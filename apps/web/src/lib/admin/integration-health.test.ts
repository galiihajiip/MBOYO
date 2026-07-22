import { describe, expect, it, vi, beforeEach } from "vitest";

interface FakeServerEnv {
  ML_API_URL: string;
  ML_INTERNAL_TOKEN: string;
  NEXT_PUBLIC_MAP_STYLE_URL?: string;
  GEMINI_API_KEY?: string;
}

const { mockGetServerEnv } = vi.hoisted(() => ({ mockGetServerEnv: vi.fn<() => FakeServerEnv>() }));

vi.mock("../env.server", () => ({ getServerEnv: () => mockGetServerEnv() }));

import { checkGeminiConfigured, checkMapProviderStatus, checkMlApiHealth } from "./integration-health";

describe("checkMlApiHealth", () => {
  beforeEach(() => {
    mockGetServerEnv.mockReturnValue({ ML_API_URL: "https://ml-api.example.com", ML_INTERNAL_TOKEN: "secret" });
  });

  it("returns unreachable when /health fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const result = await checkMlApiHealth();
    expect(result.reachable).toBe(false);
    expect(result.reason).toContain("503");

    vi.unstubAllGlobals();
  });

  it("returns unreachable when fetch throws (network error)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const result = await checkMlApiHealth();
    expect(result.reachable).toBe(false);
    expect(result.reason).toBe("ECONNREFUSED");

    vi.unstubAllGlobals();
  });

  it("returns ready + model version when /health, /ready, /model-info all succeed", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/health")) return Promise.resolve({ ok: true, status: 200 });
      if (url.endsWith("/ready")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready: true, reason: null }) });
      if (url.endsWith("/model-info"))
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ model: { version: "v1.0.0" } }) });
      return Promise.resolve({ ok: false, status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkMlApiHealth();
    expect(result.reachable).toBe(true);
    expect(result.ready).toBe(true);
    expect(result.modelVersion).toBe("v1.0.0");

    vi.unstubAllGlobals();
  });
});

describe("checkMapProviderStatus", () => {
  it("treats an unconfigured style URL as reachable (using default demo tiles)", async () => {
    mockGetServerEnv.mockReturnValue({ ML_API_URL: "x", ML_INTERNAL_TOKEN: "y", NEXT_PUBLIC_MAP_STYLE_URL: undefined });

    const result = await checkMapProviderStatus();
    expect(result.reachable).toBe(true);
  });

  it("returns unreachable when the configured style URL fetch fails", async () => {
    mockGetServerEnv.mockReturnValue({
      ML_API_URL: "x",
      ML_INTERNAL_TOKEN: "y",
      NEXT_PUBLIC_MAP_STYLE_URL: "https://maps.example.com/style.json",
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const result = await checkMapProviderStatus();
    expect(result.reachable).toBe(false);

    vi.unstubAllGlobals();
  });
});

describe("checkGeminiConfigured", () => {
  it("returns configured: false when GEMINI_API_KEY is unset", () => {
    mockGetServerEnv.mockReturnValue({ ML_API_URL: "x", ML_INTERNAL_TOKEN: "y", GEMINI_API_KEY: undefined });

    expect(checkGeminiConfigured()).toEqual({ configured: false });
  });

  it("returns configured: true when GEMINI_API_KEY is set", () => {
    mockGetServerEnv.mockReturnValue({ ML_API_URL: "x", ML_INTERNAL_TOKEN: "y", GEMINI_API_KEY: "key" });

    expect(checkGeminiConfigured()).toEqual({ configured: true });
  });
});
