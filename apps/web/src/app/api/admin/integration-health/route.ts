import type { NextRequest } from "next/server";
import { requireApiRole } from "../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../lib/api/respond";
import { resolveRequestId } from "../../../../lib/api/request-id";
import { checkGeminiConfigured, checkMapProviderStatus, checkMlApiHealth } from "../../../../lib/admin/integration-health";

export const dynamic = "force-dynamic";

/** Integration health (BLOCK 27): ML API reachability/readiness/model version, map tile provider reachability, Gemini configuration status. */
export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiRole("system_administrator");
    const [mlApi, mapProvider] = await Promise.all([checkMlApiHealth(), checkMapProviderStatus()]);
    const gemini = checkGeminiConfigured();
    return respondOk({ mlApi, mapProvider, gemini }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
