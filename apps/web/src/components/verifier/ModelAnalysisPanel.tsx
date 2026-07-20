import Link from "next/link";
import Image from "next/image";
import { Badge, ConfidenceMeter, ProbabilityBars, SeverityBadge, type SeverityClass } from "@mboyo/ui";
import type { ModelPredictionDto } from "../../lib/reports/service/analysis";
import type { ReportSummaryDto } from "../../lib/reports/service/types";

export interface ModelAnalysisPanelProps {
  prediction: ModelPredictionDto | null;
  duplicateCandidate: ReportSummaryDto | null;
}

function topSeverity(probabilities: Record<string, number>): SeverityClass {
  let bestLabel: SeverityClass = "unknown";
  let bestConfidence = -1;
  for (const [label, confidence] of Object.entries(probabilities)) {
    if (confidence > bestConfidence) {
      bestLabel = label as SeverityClass;
      bestConfidence = confidence;
    }
  }
  return bestLabel;
}

/**
 * The Verifier detail page's model-analysis section — this block's
 * "probability bars, calibration/uncertainty, Grad-CAM, model metadata,
 * duplicate links" requirements, all sourced from one
 * getLatestModelPrediction() call (lib/reports/service/analysis.ts).
 * "Grad-CAM" here actually renders apps/ml-api's occlusion-sensitivity
 * heatmap (explanation_type "occlusion_sensitivity") — the only
 * explanation technique this system produces, per that module's own
 * disclosed trade-off (true Grad-CAM would require a PyTorch dependency in
 * the ONNX-only serving path) — the panel labels it by its real name and
 * shows its disclaimer, never calling it Grad-CAM outright.
 */
export function ModelAnalysisPanel({ prediction, duplicateCandidate }: ModelAnalysisPanelProps) {
  if (!prediction) {
    return (
      <section className="flex flex-col gap-2 rounded-md border border-brand-border p-4">
        <h2 className="font-sans text-sm font-bold text-on-surface">Prediksi Model Lokal (Utama)</h2>
        <p className="font-sans text-xs text-on-surface-variant">Belum ada hasil analisis model lokal.</p>
      </section>
    );
  }

  const top = topSeverity(prediction.severityProbabilities);
  const explanation = prediction.explanations[0] ?? null;
  const heatmapBase64 =
    explanation && typeof explanation.payload.heatmapPngBase64 === "string"
      ? explanation.payload.heatmapPngBase64
      : null;
  const explanationDisclaimer =
    explanation && typeof explanation.payload.disclaimer === "string" ? explanation.payload.disclaimer : null;

  return (
    <section className="flex flex-col gap-4 rounded-md border border-brand-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-sans text-sm font-bold text-on-surface">Prediksi Model Lokal (Utama)</h2>
        <div className="flex items-center gap-2">
          {prediction.isAdvisoryOnly ? <Badge tone="warning">Belum lolos ambang evaluasi</Badge> : null}
          <SeverityBadge severity={top} />
        </div>
      </div>

      <ProbabilityBars probabilities={prediction.severityProbabilities} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ConfidenceMeter value={prediction.qualityScore} label="Skor kualitas gambar" />
        <ConfidenceMeter
          value={1 - prediction.uncertainty}
          label="Kepastian prediksi (bukan skor kalibrasi resmi)"
        />
      </div>

      {duplicateCandidate ? (
        <div className="rounded-sm bg-surface-container p-3">
          <p className="font-sans text-xs font-semibold text-on-surface">Kandidat Laporan Duplikat</p>
          <Link href={`/verifier/laporan/${duplicateCandidate.id}`} className="font-sans text-sm text-brand-deep-ocean underline">
            {duplicateCandidate.description ?? duplicateCandidate.clientReportId}
          </Link>
        </div>
      ) : null}

      {explanation ? (
        <div className="flex flex-col gap-2">
          <p className="font-sans text-xs font-semibold text-on-surface">
            Visualisasi Sensitivitas Wilayah Gambar ({explanation.explanationType === "occlusion_sensitivity" ? "occlusion sensitivity" : explanation.explanationType})
          </p>
          {heatmapBase64 ? (
            <div className="relative h-64 w-full max-w-sm overflow-hidden rounded-md border border-brand-border">
              <Image
                src={`data:image/png;base64,${heatmapBase64}`}
                alt="Visualisasi sensitivitas wilayah gambar"
                fill
                unoptimized
                className="object-contain"
              />
            </div>
          ) : null}
          {explanationDisclaimer ? (
            <p className="font-sans text-xs italic text-on-surface-variant">{explanationDisclaimer}</p>
          ) : null}
        </div>
      ) : null}

      {prediction.model ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-sans text-xs">
          <dt className="text-on-surface-variant">Versi model</dt>
          <dd className="font-mono text-on-surface">{prediction.model.version}</dd>
          <dt className="text-on-surface-variant">Dilatih pada</dt>
          <dd className="text-on-surface">{new Date(prediction.model.trainedAt).toLocaleString("id-ID")}</dd>
          {prediction.model.promotedAt ? (
            <>
              <dt className="text-on-surface-variant">Dipromosikan pada</dt>
              <dd className="text-on-surface">{new Date(prediction.model.promotedAt).toLocaleString("id-ID")}</dd>
            </>
          ) : null}
        </dl>
      ) : null}
    </section>
  );
}
