import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../../../../../lib/supabase/server";
import { requireApiRole } from "../../../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../../../lib/api/respond";
import { resolveRequestId } from "../../../../../../lib/api/request-id";
import { getReportById } from "../../../../../../lib/reports/service/detail";
import { listReportEvidence } from "../../../../../../lib/reports/service/evidence";
import { listLocationObservations } from "../../../../../../lib/reports/service/location";
import { getLatestModelPrediction } from "../../../../../../lib/reports/service/analysis";

export const dynamic = "force-dynamic";

/**
 * Full-ish report payload for Antrean Verifikasi's inline "Detail Preview"
 * panel (BLOCK 23's queue-list-only screen gained an inline preview, per
 * this iteration's UI redesign) — richer than
 * /api/reports/[reportId]/pin-summary (every evidence photo, not just the
 * first; the full model prediction incl. explanations/model metadata via
 * getLatestModelPrediction). Verifier-only (requireApiRole, not
 * requireApiActor) because getLatestModelPrediction joins
 * model_registry_entries, which only Verifier/Admin/Auditor can SELECT —
 * see pin-summary's route.ts comment for the full RLS explanation of why
 * that join can't be reused across every role that has a queue/map.
 *
 * Still deliberately NOT the full detail page's payload — no review
 * history, no Gemini advisory, no duplicate-candidate summary — those stay
 * exclusive to the full /verifier/laporan/[reportId] page so this preview
 * loads fast and the full page remains the one place with every field.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiRole("verifier");
    const supabase = await createServerSupabaseClient();
    const { reportId } = await params;

    const [report, evidence, locations, prediction] = await Promise.all([
      getReportById(supabase, reportId),
      listReportEvidence(supabase, reportId),
      listLocationObservations(supabase, reportId),
      getLatestModelPrediction(supabase, reportId),
    ]);

    const latestLocation = locations[0] ?? null;

    return respondOk(
      {
        report: {
          id: report.id,
          status: report.status,
          description: report.description,
          submittedAt: report.submittedAt,
        },
        location: latestLocation
          ? {
              longitude: latestLocation.longitude,
              latitude: latestLocation.latitude,
              manualAddress: latestLocation.manualAddress,
              accuracyMeters: latestLocation.accuracyMeters,
            }
          : null,
        evidence: evidence.map((e) => ({
          id: e.id,
          signedUrl: e.signedUrl,
          thumbnailSignedUrl: e.thumbnailSignedUrl,
        })),
        prediction: prediction
          ? {
              topSeverity:
                Object.entries(prediction.severityProbabilities).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
              topConfidence: Object.entries(prediction.severityProbabilities).sort((a, b) => b[1] - a[1])[0]?.[1] ?? null,
              qualityScore: prediction.qualityScore,
              isAdvisoryOnly: prediction.isAdvisoryOnly,
            }
          : null,
      },
      requestId,
      200,
    );
  } catch (error) {
    return respondError(error, requestId);
  }
}
