import type { Metadata } from "next";
import { Badge } from "@mboyo/ui";
import { checkGeminiConfigured, checkMapProviderStatus, checkMlApiHealth } from "../../../lib/admin/integration-health";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Integrasi — MBOYO" };

function StatusBadgeInline({ ok, label }: { ok: boolean; label: string }) {
  return <Badge tone={ok ? "success" : "critical"}>{label}</Badge>;
}

/**
 * Integrasi (BLOCK 27) — replacing the earlier stub. Live reachability
 * status for the three optional/external integrations this platform has:
 * ML API (reachability + readiness + loaded model version — the first
 * apps/web -> apps/ml-api HTTP call in this codebase), map tile provider
 * (fetches the configured style URL), and Gemini (configuration presence
 * only — no reachability probe, since that would cost a real API call
 * just to check status, per BLOCK 22's "Gemini is optional and its
 * absence is normal" posture). Worker process liveness is NOT directly
 * observable here — apps/worker's heartbeat only logs to its own stdout,
 * exposes no HTTP endpoint, and writes nothing queryable (confirmed by
 * research) — this is disclosed explicitly rather than faked with a
 * fabricated "online" indicator; analysis_jobs queue/failure counts on
 * Kesehatan Sistem (BLOCK 26) are the closest available indirect signal.
 */
export default async function IntegrasiPage() {
  const [mlApi, mapProvider] = await Promise.all([checkMlApiHealth(), checkMapProviderStatus()]);
  const gemini = checkGeminiConfigured();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-sans text-2xl font-bold text-on-surface">Integrasi</h1>

      <section className="flex flex-col gap-2 rounded-md border border-brand-border p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-sans text-sm font-bold text-on-surface">ML API</h2>
          <StatusBadgeInline ok={mlApi.reachable} label={mlApi.reachable ? "Terjangkau" : "Tidak Terjangkau"} />
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-sans text-xs">
          <dt className="text-on-surface-variant">Status Kesiapan</dt>
          <dd className="text-on-surface">{mlApi.ready === null ? "Tidak diketahui" : mlApi.ready ? "Siap" : "Belum Siap"}</dd>
          <dt className="text-on-surface-variant">Versi Model Dimuat</dt>
          <dd className="font-mono text-on-surface">{mlApi.modelVersion ?? "Tidak diketahui"}</dd>
          {mlApi.reason ? (
            <>
              <dt className="text-on-surface-variant">Catatan</dt>
              <dd className="text-on-surface">{mlApi.reason}</dd>
            </>
          ) : null}
        </dl>
      </section>

      <section className="flex flex-col gap-2 rounded-md border border-brand-border p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-sans text-sm font-bold text-on-surface">Worker Analisis</h2>
          <Badge tone="neutral">Tidak Dapat Dipantau Langsung</Badge>
        </div>
        <p className="font-sans text-xs text-on-surface-variant">
          Proses worker tidak mengekspos status langsung yang dapat diperiksa dari sini. Lihat kedalaman antrean dan
          kegagalan analisis pada halaman Kesehatan Sistem sebagai indikator tidak langsung.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-md border border-brand-border p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-sans text-sm font-bold text-on-surface">Peta (Penyedia Ubin Peta)</h2>
          <StatusBadgeInline ok={mapProvider.reachable} label={mapProvider.reachable ? "Terjangkau" : "Tidak Terjangkau"} />
        </div>
        {mapProvider.reason ? <p className="font-sans text-xs text-on-surface-variant">{mapProvider.reason}</p> : null}
      </section>

      <section className="flex flex-col gap-2 rounded-md border border-brand-border p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-sans text-sm font-bold text-on-surface">Gemini (Analisis Tambahan Eksternal)</h2>
          <Badge tone={gemini.configured ? "success" : "neutral"}>
            {gemini.configured ? "Dikonfigurasi" : "Tidak Dikonfigurasi"}
          </Badge>
        </div>
        <p className="font-sans text-xs text-on-surface-variant">
          Fitur opsional — sistem berfungsi penuh tanpa konfigurasi ini. Lihat Kesehatan Sistem untuk riwayat
          penggunaan.
        </p>
      </section>
    </div>
  );
}
