"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@mboyo/ui";
import type { ReportDraft } from "../../../../../lib/reports/types";

const MapPin = dynamic(() => import("../../../../../components/map/MapPin").then((mod) => mod.MapPin), {
  ssr: false,
  loading: () => (
    <div className="flex h-56 w-full items-center justify-center rounded-md border border-brand-border bg-surface-container-lowest">
      <p className="font-sans text-sm text-on-surface-variant">Memuat peta...</p>
    </div>
  ),
});

export interface GpsStepProps {
  draft: ReportDraft;
  setDraft: (updater: (current: ReportDraft) => ReportDraft) => void;
  onUseManualFallback: () => void;
}

type CaptureState = "idle" | "requesting" | "denied" | "unavailable";

/**
 * Step 4 — GPS capture. Per this block's UX requirement, GPS accuracy
 * limitation is disclosed explicitly (never implied to be exact — an
 * accuracy circle is drawn on the map, not just stated as text), and per
 * docs/product/RISK_REGISTER.md risk #3, a Reporter without a location fix
 * can still proceed — "Gunakan Peta / Alamat Manual" always visible, never
 * a dead end.
 *
 * maximumAge: 0 is explicit (not just the Geolocation API's implicit
 * default) — a Reporter tapping "Ambil Ulang Lokasi" after moving expects
 * a genuinely fresh fix, never a cached position silently reused.
 */
export function GpsStep({ draft, setDraft, onUseManualFallback }: GpsStepProps) {
  const [state, setState] = useState<CaptureState>("idle");

  function requestLocation() {
    if (!("geolocation" in navigator)) {
      setState("unavailable");
      return;
    }
    setState("requesting");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState("idle");
        setDraft((current) => ({
          ...current,
          location: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
            altitudeMeters: position.coords.altitude,
            headingDegrees: position.coords.heading,
            capturedAtClient: new Date(position.timestamp).toISOString(),
            source: "gps",
            manualAddress: null,
          },
        }));
      },
      () => {
        setState("denied");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  const location = draft.location;
  const hasGpsLocation = location?.source === "gps";

  return (
    <div className="flex flex-col gap-4">
      <p className="font-sans text-sm text-on-surface-variant">
        Lokasi GPS membantu tim respons menemukan lokasi kejadian dengan cepat.
      </p>

      {hasGpsLocation ? (
        <div className="rounded-md border border-brand-border bg-surface-container-lowest p-4">
          <MapPin
            longitude={location.longitude}
            latitude={location.latitude}
            accuracyMeters={location.accuracyMeters}
            draggable={false}
            heightClassName="h-56"
          />
          <p className="mt-3 font-mono text-sm text-on-surface">
            {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
          </p>
          <p className="mt-1 font-sans text-xs text-on-surface-variant">
            Akurasi perkiraan: {location.accuracyMeters ? `±${Math.round(location.accuracyMeters)} meter` : "tidak diketahui"}
            {" "}(area lingkaran biru pada peta). Lokasi GPS bersifat perkiraan dan dapat bergeser
            beberapa meter tergantung kondisi perangkat dan lingkungan — bukan posisi yang pasti
            akurat.
          </p>
          <Button type="button" variant="ghost" className="mt-3" onClick={requestLocation}>
            Ambil Ulang Lokasi
          </Button>
        </div>
      ) : (
        <Button type="button" onClick={requestLocation} disabled={state === "requesting"}>
          {state === "requesting" ? "Mengambil lokasi..." : "Aktifkan Lokasi GPS"}
        </Button>
      )}

      {state === "denied" ? (
        <p className="font-sans text-sm text-brand-critical-red">
          Izin lokasi ditolak atau tidak tersedia saat ini. Anda tetap dapat melanjutkan dengan
          menandai lokasi secara manual.
        </p>
      ) : null}
      {state === "unavailable" ? (
        <p className="font-sans text-sm text-brand-critical-red">
          Perangkat ini tidak mendukung layanan lokasi. Silakan tandai lokasi secara manual.
        </p>
      ) : null}

      <button
        type="button"
        onClick={onUseManualFallback}
        className="min-h-11 self-start font-sans text-sm font-semibold text-brand-signal-cyan hover:underline"
      >
        Gunakan Peta / Alamat Manual
      </button>
    </div>
  );
}
