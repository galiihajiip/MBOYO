import { severityLabels, reportStatusLabelsInternal, type SeverityClass } from "@mboyo/ui";
import type { ReportStatus } from "@mboyo/domain";

interface PinSummaryResponse {
  report: { id: string; status: ReportStatus; description: string | null; submittedAt: string | null };
  location: { longitude: number; latitude: number; manualAddress: string | null; accuracyMeters: number | null } | null;
  classification: { topSeverity: SeverityClass | null; qualityScore: number | null; isAdvisoryOnly: boolean | null };
  thumbnailUrl: string | null;
  evidenceCount: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Renders the popup body HTML for a map pin (Peta Krisis / Peta Bukti) —
 * fetches /api/reports/[reportId]/pin-summary and builds the same markup
 * both maps show on click, so a report's popup looks identical regardless
 * of which map surfaced it. Returns a container element synchronously (so
 * the caller can attach it to a maplibregl.Popup immediately) and fills it
 * in once the fetch resolves, showing a loading state in between.
 *
 * Deliberately never renders a "kontak"/contact field — reporter contact
 * info is never sent to or stored on the server at all (client-side only,
 * see lib/reports/types.ts's ContactPreference — a privacy choice, not a
 * gap), so showing one here would mean fabricating data that doesn't
 * exist. The "alamat" line is the recorded manual address when a Reporter
 * supplied one, otherwise the raw GPS coordinates — never a geocoded
 * street address, since no reverse-geocoding provider is configured
 * (reverse_geocode_cache exists but is populated by an optional adapter,
 * see supabase/migrations/20260717043726_location_trust.sql).
 */
export function renderReportPinPopup(reportId: string, detailHref: string): HTMLDivElement {
  const container = document.createElement("div");
  container.className = "flex flex-col gap-2 p-1 font-sans text-sm min-w-[220px] max-w-[260px]";
  container.innerHTML = `<p class="text-on-surface-variant text-xs">Memuat detail laporan...</p>`;

  void fetch(`/api/reports/${reportId}/pin-summary`)
    .then((res) => res.json())
    .then((json: { ok: boolean; data?: PinSummaryResponse }) => {
      if (!json.ok || !json.data) {
        container.innerHTML = `<p class="text-brand-critical-red text-xs">Gagal memuat detail laporan.</p>`;
        return;
      }
      const d = json.data;
      const severityLabel = d.classification.topSeverity ? severityLabels[d.classification.topSeverity] : "Belum dianalisis";
      const statusLabel = reportStatusLabelsInternal[d.report.status] ?? d.report.status;
      const addressLine = d.location
        ? d.location.manualAddress ?? `${d.location.latitude.toFixed(5)}, ${d.location.longitude.toFixed(5)}`
        : "Lokasi tidak tercatat";
      const submitted = d.report.submittedAt
        ? new Date(d.report.submittedAt).toLocaleString("id-ID")
        : "Belum dikirim";
      const description = d.report.description ? escapeHtml(d.report.description) : "(Tidak ada deskripsi)";

      container.innerHTML = `
        ${
          d.thumbnailUrl
            ? `<img src="${escapeHtml(d.thumbnailUrl)}" alt="Bukti foto laporan" class="w-full h-28 object-cover rounded-md border border-brand-border" />`
            : `<div class="w-full h-20 flex items-center justify-center rounded-md border border-dashed border-brand-border text-on-surface-variant text-xs">Tidak ada foto</div>`
        }
        <p class="font-bold text-on-surface leading-snug">${description}</p>
        <dl class="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs text-on-surface-variant">
          <dt class="font-semibold">Klasifikasi</dt><dd>${escapeHtml(severityLabel)}</dd>
          <dt class="font-semibold">Status</dt><dd>${escapeHtml(statusLabel)}</dd>
          <dt class="font-semibold">Lokasi</dt><dd>${escapeHtml(addressLine)}</dd>
          <dt class="font-semibold">Dikirim</dt><dd>${escapeHtml(submitted)}</dd>
          <dt class="font-semibold">Bukti</dt><dd>${d.evidenceCount} foto</dd>
        </dl>
        <a href="${escapeHtml(detailHref)}" class="mt-1 text-center rounded-md bg-brand-ink-navy px-2 py-1.5 text-xs font-semibold text-white hover:bg-brand-deep-ocean">Lihat Detail Lengkap</a>
      `;
    })
    .catch(() => {
      container.innerHTML = `<p class="text-brand-critical-red text-xs">Gagal memuat detail laporan.</p>`;
    });

  return container;
}
