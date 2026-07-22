import "server-only";
import { getServerEnv } from "../env.server";

export interface MlApiHealthStatus {
  reachable: boolean;
  ready: boolean | null;
  modelVersion: string | null;
  reason: string | null;
}

const HEALTH_CHECK_TIMEOUT_MS = 5000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Checks apps/ml-api's reachability and readiness — the first-ever
 * apps/web -> apps/ml-api HTTP call in this codebase (confirmed by
 * research: no prior fetch to ML_API_URL exists anywhere in apps/web).
 * Calls /health (no auth) to establish reachability, then /ready (which
 * requires ML_INTERNAL_TOKEN, the same Authorization: Bearer convention
 * apps/worker's ml_api_client.py already uses) for the actual model-ready
 * state. Never throws — a genuinely unreachable ML API is exactly the
 * "down" status this function needs to report, not an exception this
 * page should crash on.
 */
export async function checkMlApiHealth(): Promise<MlApiHealthStatus> {
  const env = getServerEnv();

  try {
    const healthResponse = await fetchWithTimeout(`${env.ML_API_URL}/health`, { method: "GET" });
    if (!healthResponse.ok) {
      return { reachable: false, ready: null, modelVersion: null, reason: `HTTP ${healthResponse.status}` };
    }
  } catch (error) {
    return {
      reachable: false,
      ready: null,
      modelVersion: null,
      reason: error instanceof Error ? error.message : "Tidak dapat dijangkau.",
    };
  }

  try {
    const [readyResponse, modelInfoResponse] = await Promise.all([
      fetchWithTimeout(`${env.ML_API_URL}/ready`, {
        method: "GET",
        headers: { Authorization: `Bearer ${env.ML_INTERNAL_TOKEN}` },
      }),
      fetchWithTimeout(`${env.ML_API_URL}/model-info`, {
        method: "GET",
        headers: { Authorization: `Bearer ${env.ML_INTERNAL_TOKEN}` },
      }),
    ]);

    const readyBody = readyResponse.ok
      ? ((await readyResponse.json()) as { ready: boolean; reason: string | null })
      : null;
    const modelInfoBody = modelInfoResponse.ok
      ? ((await modelInfoResponse.json()) as { model?: { version?: string } })
      : null;

    return {
      reachable: true,
      ready: readyBody?.ready ?? null,
      modelVersion: modelInfoBody?.model?.version ?? null,
      reason: readyBody?.reason ?? null,
    };
  } catch (error) {
    // /health succeeded but /ready or /model-info failed — still
    // "reachable" (the service is up), just unable to report readiness
    // detail right now.
    return {
      reachable: true,
      ready: null,
      modelVersion: null,
      reason: error instanceof Error ? error.message : "Gagal memuat status kesiapan.",
    };
  }
}

export interface MapProviderStatus {
  reachable: boolean;
  reason: string | null;
}

/**
 * Checks whether the configured map tile style URL is reachable — "map
 * status," a concept that did not exist anywhere in this codebase before
 * this block (confirmed by research). No style URL configured is treated
 * as "not applicable" (reachable: true, so the health page doesn't show
 * a false alarm for the documented fallback-to-demo-tiles behavior
 * MapPin.tsx/EvidenceMap.tsx/CrisisMap.tsx already implement client-side).
 */
export async function checkMapProviderStatus(): Promise<MapProviderStatus> {
  const styleUrl = getServerEnv().NEXT_PUBLIC_MAP_STYLE_URL;
  if (!styleUrl) {
    return { reachable: true, reason: "Menggunakan gaya peta demo bawaan (tidak dikonfigurasi)." };
  }

  try {
    const response = await fetchWithTimeout(styleUrl, { method: "GET" });
    return { reachable: response.ok, reason: response.ok ? null : `HTTP ${response.status}` };
  } catch (error) {
    return { reachable: false, reason: error instanceof Error ? error.message : "Tidak dapat dijangkau." };
  }
}

export interface GeminiConfigStatus {
  configured: boolean;
}

/** Whether Gemini is configured at all — reachability/quota checks aren't attempted (would require spending a real API call just to check status), matching this codebase's "Gemini is optional and its absence is normal" posture (BLOCK 22). */
export function checkGeminiConfigured(): GeminiConfigStatus {
  const env = getServerEnv();
  return { configured: Boolean(env.GEMINI_API_KEY) };
}
