import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { requireApiPermission } from "../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../lib/api/respond";
import { resolveRequestId } from "../../../../lib/api/request-id";
import { listCommandMapReports, type MapBoundingBox } from "../../../../lib/command/map";

export const dynamic = "force-dynamic";

function parseBbox(params: URLSearchParams): MapBoundingBox | undefined {
  const minLon = params.get("minLon");
  const minLat = params.get("minLat");
  const maxLon = params.get("maxLon");
  const maxLat = params.get("maxLat");
  if (minLon === null || minLat === null || maxLon === null || maxLat === null) return undefined;
  return {
    minLon: Number(minLon),
    minLat: Number(minLat),
    maxLon: Number(maxLon),
    maxLat: Number(maxLat),
  };
}

/** Verified reports with a recorded location, for Peta Krisis — optionally scoped to a viewport bbox. */
export async function GET(request: NextRequest) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiPermission("report", "read");
    const supabase = await createServerSupabaseClient();
    const params = request.nextUrl.searchParams;
    const reports = await listCommandMapReports(supabase, {
      disasterEventId: params.get("disasterEventId") ?? undefined,
      bbox: parseBbox(params),
    });
    return respondOk({ reports }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
