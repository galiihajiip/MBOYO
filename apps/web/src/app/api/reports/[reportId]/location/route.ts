import type { NextRequest } from "next/server";
import { submitLocationObservationSchema } from "@mboyo/domain";
import { createServerSupabaseClient } from "../../../../../lib/supabase/server";
import { requireApiPermission } from "../../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../../lib/api/respond";
import { resolveRequestId } from "../../../../../lib/api/request-id";
import { recordLocationObservation, listLocationObservations } from "../../../../../lib/reports/service/location";

export const dynamic = "force-dynamic";

/**
 * Records one location observation for a report (GPS capture, manual map
 * pin, or manual address) — see lib/reports/service/location.ts for why
 * this always inserts a new row rather than mutating a single "the"
 * location field. Longitude is the first coordinate accepted (`longitude`
 * before `latitude` in the schema and the RPC call), matching this block's
 * "GeoJSON must use [longitude, latitude]" requirement end to end from
 * client payload through to the PostGIS point construction.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  const requestId = resolveRequestId(request);

  try {
    await requireApiPermission("geolocation_observation", "create");
    const supabase = await createServerSupabaseClient();
    const { reportId } = await params;

    const body: unknown = await request.json().catch(() => null);
    const input = submitLocationObservationSchema.parse(body);

    const observation = await recordLocationObservation(supabase, reportId, input);
    return respondOk({ observation }, requestId, 201);
  } catch (error) {
    return respondError(error, requestId);
  }
}

/**
 * Lists every observation recorded for a report — the data the Verifier UI
 * (source, accuracy, timestamp, boundary, distance per this block's
 * requirement) reads from. RLS is the authorization boundary for which
 * reports' observations are visible at all; this route applies no
 * additional row-level filtering.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  const requestId = resolveRequestId(request);

  try {
    await requireApiPermission("geolocation_observation", "read");
    const supabase = await createServerSupabaseClient();
    const { reportId } = await params;

    const observations = await listLocationObservations(supabase, reportId);
    return respondOk({ observations }, requestId, 200);
  } catch (error) {
    return respondError(error, requestId);
  }
}
