"use client";

import dynamic from "next/dynamic";
import { Badge, ConfidenceMeter } from "@mboyo/ui";
import type { LocationObservationDto } from "../../lib/reports/service/location";

const MapPin = dynamic(() => import("../map/MapPin").then((mod) => mod.MapPin), {
  ssr: false,
  loading: () => (
    <div className="flex h-56 w-full items-center justify-center rounded-md border border-brand-border bg-surface-container-lowest">
      <p className="font-sans text-sm text-on-surface-variant">Memuat peta...</p>
    </div>
  ),
});

export interface LocationTrustPanelProps {
  observations: LocationObservationDto[];
}

const SOURCE_LABELS: Record<LocationObservationDto["source"], string> = {
  gps: "GPS Perangkat",
  manual_pin: "Penanda Peta Manual",
  manual_address: "Alamat Manual",
};

const FLAG_LABELS: Record<string, string> = {
  outside_event_boundary: "Di luar batas wilayah kejadian",
  duplicate_coordinates: "Koordinat sama dengan pengamatan sebelumnya",
  implausible_accuracy: "Nilai akurasi GPS tidak wajar",
};

/**
 * Verifier-facing location trust display — this block's explicit
 * requirement: "Verifier UI shows source, accuracy, timestamp, boundary,
 * and distance." Shows every recorded observation (not just the latest),
 * since a Verifier judging trust benefits from seeing e.g. three GPS
 * attempts landing within meters of each other vs. a single uncorroborated
 * manual pin (see lib/reports/service/location.ts's listLocationObservations
 * doc comment). No Verifier report-detail screen exists yet (still a
 * BLOCK 11 nav stub per BLOCK 15/16 precedent) — this component is the
 * data-correct, ready-to-drop-in piece for that future screen, per the
 * same "build the data layer, defer the full screen" pattern those blocks
 * used.
 *
 * Never states a location is confirmed/verified/exact — every heading and
 * label below describes a signal or a distance, never a claim of ground
 * truth, per this block's "Never describe GPS as guaranteed truth"
 * requirement.
 */
export function LocationTrustPanel({ observations }: LocationTrustPanelProps) {
  if (observations.length === 0) {
    return (
      <div className="rounded-md border border-brand-border bg-surface-container-lowest p-4">
        <p className="font-sans text-sm text-on-surface-variant">Belum ada data lokasi untuk laporan ini.</p>
      </div>
    );
  }

  const [latest, ...earlier] = observations;

  return (
    <div className="flex flex-col gap-4">
      {latest ? <ObservationCard observation={latest} highlight /> : null}
      {earlier.length > 0 ? (
        <details className="rounded-md border border-brand-border">
          <summary className="min-h-11 cursor-pointer px-4 py-2 font-sans text-sm font-medium text-on-surface">
            {earlier.length} pengamatan lokasi sebelumnya
          </summary>
          <div className="flex flex-col gap-3 border-t border-brand-border p-4">
            {earlier.map((observation) => (
              <ObservationCard key={observation.id} observation={observation} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function ObservationCard({
  observation,
  highlight = false,
}: {
  observation: LocationObservationDto;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "rounded-md border border-brand-signal-cyan bg-brand-signal-cyan/5 p-4"
          : "rounded-md border border-brand-border p-3"
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="info">{SOURCE_LABELS[observation.source]}</Badge>
        {observation.outsideEventBoundary === true ? (
          <Badge tone="warning">Di luar batas wilayah kejadian</Badge>
        ) : null}
        {observation.outsideEventBoundary === false ? <Badge tone="success">Dalam batas wilayah kejadian</Badge> : null}
      </div>

      {highlight ? (
        <div className="mt-3">
          {/* Read-only map: draggable=false, so this is display-only — never editable from the Verifier side. */}
          <MapPin
            longitude={observation.longitude}
            latitude={observation.latitude}
            accuracyMeters={observation.accuracyMeters}
            draggable={false}
            heightClassName="h-56"
          />
        </div>
      ) : null}

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 font-sans text-sm">
        <dt className="text-on-surface-variant">Waktu perekaman</dt>
        <dd className="text-on-surface">{new Date(observation.capturedAtClient).toLocaleString("id-ID")}</dd>

        <dt className="text-on-surface-variant">Akurasi perangkat</dt>
        <dd className="text-on-surface">
          {observation.accuracyMeters !== null ? `±${Math.round(observation.accuracyMeters)} meter` : "Tidak diketahui"}
        </dd>

        <dt className="text-on-surface-variant">Jarak ke pusat wilayah kejadian</dt>
        <dd className="text-on-surface">
          {observation.distanceToEventCenterMeters !== null
            ? `${Math.round(observation.distanceToEventCenterMeters)} meter`
            : "Tidak dapat dihitung (wilayah kejadian belum ditentukan)"}
        </dd>

        {observation.manualAddress ? (
          <>
            <dt className="text-on-surface-variant">Alamat (dari pelapor)</dt>
            <dd className="text-on-surface">{observation.manualAddress}</dd>
          </>
        ) : null}
      </dl>

      {observation.confidenceSignal !== null ? (
        <div className="mt-3">
          <ConfidenceMeter value={observation.confidenceSignal} label="Sinyal keyakinan lokasi (bukan jaminan akurasi)" />
        </div>
      ) : null}

      {observation.suspiciousPatternFlags.length > 0 ? (
        <div className="mt-3 flex flex-col gap-1">
          <p className="font-sans text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Ditandai untuk tinjauan manual
          </p>
          <ul className="flex flex-col gap-1">
            {observation.suspiciousPatternFlags.map((flag) => (
              <li key={flag} className="font-sans text-sm text-brand-caution-amber">
                {FLAG_LABELS[flag] ?? flag}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-3 font-sans text-xs text-on-surface-variant">
        Lokasi bersifat perkiraan berdasarkan data perangkat pelapor dan tidak dapat dijamin akurat
        sepenuhnya — gunakan bersama bukti foto dan konteks lain sebelum mengambil keputusan.
      </p>
    </div>
  );
}
