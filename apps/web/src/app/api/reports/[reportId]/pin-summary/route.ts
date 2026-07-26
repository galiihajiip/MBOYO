import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "../../../../../lib/supabase/server";
import { requireApiActor } from "../../../../../lib/api/authorize";
import { respondOk, respondError } from "../../../../../lib/api/respond";
import { resolveRequestId } from "../../../../../lib/api/request-id";
import { getReportById } from "../../../../../lib/reports/service/detail";
import { listReportEvidence } from "../../../../../lib/reports/service/evidence";
import { listLocationObservations } from "../../../../../lib/reports/service/location";

export const dynamic = "force-dynamic";

interface MinimalPredictionRow {
  severity_probabilities: Record<string, number>;
  quality_score: number;
  is_advisory_only: boolean;
}

/**
 * Compact report summary for the map pin popup (Peta Krisis / Peta Bukti) —
 * deliberately not the full detail page's payload (no review history, no
 * Gemini advisory, no duplicate-candidate lookup). Reuses the same
 * RLS-scoped queries as the full detail page for report/evidence/location,
 * so a role only ever sees a pin-popup for a report its own reports SELECT
 * policy already allows — requireApiActor (not requireApiRole) since every
 * role that can see a pin at all (Verifier/Coordinator/Auditor) is already
 * RLS-scoped correctly by the report list query that produced the pin in
 * the first place.
 *
 * Deliberately does NOT call lib/reports/service/analysis.ts's
 * getLatestModelPrediction() — that function joins model_registry_entries,
 * which only Verifier/Admin/Auditor can SELECT (see
 * model_registry_entries_* policies, supabase/migrations/20260716153711_rls_policies.sql).
 * A Coordinator has its own model_predictions_coordinator_select_verified
 * policy on model_predictions itself, but the embedded
 * model_registry_entries(...) join fails under force RLS for a role with
 * no policy on that joined table — so this route runs its own
 * model_registry_entries-free query instead of reusing the shared helper.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  const requestId = resolveRequestId(request);
  try {
    await requireApiActor();
    const supabase = await createServerSupabaseClient();
    const { reportId } = await params;

    const [report, evidence, locations, predictionResult] = await Promise.all([
      getReportById(supabase, reportId),
      listReportEvidence(supabase, reportId),
      listLocationObservations(supabase, reportId),
      supabase
        .from("model_predictions")
        .select("severity_probabilities, quality_score, is_advisory_only")
        .eq("report_id", reportId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<MinimalPredictionRow>(),
    ]);

    const prediction = predictionResult.data;
    const latestLocation = locations[0] ?? null;
    const topSeverity = prediction
      ? (Object.entries(prediction.severity_probabilities).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null)
      : null;

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
        classification: {
          topSeverity,
          qualityScore: prediction?.quality_score ?? null,
          isAdvisoryOnly: prediction?.is_advisory_only ?? null,
        },
        thumbnailUrl: evidence[0]?.thumbnailSignedUrl ?? evidence[0]?.signedUrl ?? null,
        evidenceCount: evidence.length,
      },
      requestId,
      200,
    );
  } catch (error) {
    return respondError(error, requestId);
  }
}
