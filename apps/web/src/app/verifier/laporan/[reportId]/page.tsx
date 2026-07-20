import type { Metadata } from "next";
import { EmptyState, StatusBadge, reportStatusLabelsInternal } from "@mboyo/ui";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { getServerEnv } from "../../../../lib/env.server";
import { getReportById } from "../../../../lib/reports/service/detail";
import { listReportEvidence } from "../../../../lib/reports/service/evidence";
import { listLocationObservations } from "../../../../lib/reports/service/location";
import { getLatestModelPrediction, getDuplicateCandidateSummary } from "../../../../lib/reports/service/analysis";
import { listVerificationReviews } from "../../../../lib/reports/service/review-history";
import { listGeminiAdvisoryRequests } from "../../../../lib/reports/service/gemini-advisory";
import { ApiError } from "../../../../lib/api/errors";
import { GeminiAdvisoryPanel } from "../../../../components/verifier/GeminiAdvisoryPanel";
import { EvidenceGallery } from "../../../../components/verifier/EvidenceGallery";
import { LocationTrustPanel } from "../../../../components/verifier/LocationTrustPanel";
import { ModelAnalysisPanel } from "../../../../components/verifier/ModelAnalysisPanel";
import { ReviewHistoryTimeline } from "../../../../components/verifier/ReviewHistoryTimeline";
import { DecisionPanel } from "../../../../components/verifier/DecisionPanel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Detail Laporan — MBOYO" };

const DECIDABLE_STATUSES = new Set(["analysis_completed", "needs_manual_review"]);

/**
 * Verifier's report-detail view (BLOCK 23) — composes every piece this
 * block's "Detail" and "Actions" requirements call for: private evidence
 * with zoom (EvidenceGallery, signed URLs generated fresh per request),
 * quality/duplicate-candidate/probability-bars/calibration-uncertainty/
 * model-metadata/occlusion-sensitivity ("Grad-CAM", see
 * ModelAnalysisPanel's own comment on the naming trade-off) via
 * ModelAnalysisPanel, GPS source/accuracy/boundary via the existing
 * LocationTrustPanel (BLOCK 17, previously built but never mounted), the
 * optional Gemini advisory panel (BLOCK 22, unchanged), reporter text
 * (report.description), the full immutable review history via
 * ReviewHistoryTimeline, and the six-action DecisionPanel (BLOCK 23) — only
 * rendered while the report is actually in a decidable status, since
 * submit_verification_decision() rejects any other status server-side.
 */
export default async function VerifierReportDetailPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  const supabase = await createServerSupabaseClient();

  let report;
  try {
    report = await getReportById(supabase, reportId);
  } catch (error) {
    if (error instanceof ApiError && error.code === "not_found") {
      return <EmptyState title="Laporan tidak ditemukan" description="Laporan ini tidak ditemukan." />;
    }
    throw error;
  }

  const [evidence, locationObservations, prediction, reviews, advisories] = await Promise.all([
    listReportEvidence(supabase, reportId),
    listLocationObservations(supabase, reportId),
    getLatestModelPrediction(supabase, reportId),
    listVerificationReviews(supabase, reportId),
    listGeminiAdvisoryRequests(supabase, reportId),
  ]);

  const duplicateCandidate = await getDuplicateCandidateSummary(
    supabase,
    prediction?.duplicateCandidateReportId ?? null,
  );

  const geminiConfigured = Boolean(getServerEnv().GEMINI_API_KEY);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-sans text-2xl font-bold text-on-surface">Detail Laporan</h1>
        <StatusBadge label={reportStatusLabelsInternal[report.status]} tone="info" />
      </div>

      <p className="font-sans text-sm text-on-surface">{report.description ?? "(Tidak ada deskripsi)"}</p>

      <section className="flex flex-col gap-2 rounded-md border border-brand-border p-4">
        <h2 className="font-sans text-sm font-bold text-on-surface">Bukti Foto</h2>
        <EvidenceGallery evidence={evidence} />
      </section>

      <ModelAnalysisPanel prediction={prediction} duplicateCandidate={duplicateCandidate} />

      <section className="flex flex-col gap-2 rounded-md border border-brand-border p-4">
        <h2 className="font-sans text-sm font-bold text-on-surface">Kepercayaan Lokasi</h2>
        <LocationTrustPanel observations={locationObservations} />
      </section>

      <GeminiAdvisoryPanel reportId={reportId} initialAdvisories={advisories} geminiConfigured={geminiConfigured} />

      <section className="flex flex-col gap-2 rounded-md border border-brand-border p-4">
        <h2 className="font-sans text-sm font-bold text-on-surface">Riwayat Tinjauan</h2>
        <ReviewHistoryTimeline reviews={reviews} />
      </section>

      {DECIDABLE_STATUSES.has(report.status) ? <DecisionPanel reportId={reportId} /> : null}
    </div>
  );
}
