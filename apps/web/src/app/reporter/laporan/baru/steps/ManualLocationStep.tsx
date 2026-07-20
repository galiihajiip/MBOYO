"use client";

import dynamic from "next/dynamic";
import { Input, Textarea } from "@mboyo/ui";
import type { ReportDraft } from "../../../../../lib/reports/types";

const MapPin = dynamic(() => import("../../../../../components/map/MapPin").then((mod) => mod.MapPin), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 w-full items-center justify-center rounded-md border border-brand-border bg-surface-container-lowest">
      <p className="font-sans text-sm text-on-surface-variant">Memuat peta...</p>
    </div>
  ),
});

export interface ManualLocationStepProps {
  draft: ReportDraft;
  setDraft: (updater: (current: ReportDraft) => ReportDraft) => void;
}

/** Jakarta — used only as an initial map center before the Reporter has placed a pin; never written to the draft on its own. */
const DEFAULT_CENTER = { longitude: 106.827, latitude: -6.175 };

/**
 * Step 5 — Manual location fallback (map pin/address), shown when GPS is
 * unavailable or the Reporter opts out of it. A real draggable MapLibre pin
 * (this block) alongside numeric coordinate inputs and a free-text address
 * field — three ways to specify the same location, kept in sync — so the
 * flow is never blocked on GPS per docs/product/RISK_REGISTER.md risk #3.
 * The map is dynamically imported with ssr:false since maplibre-gl
 * requires a browser/WebGL context (see components/map/MapPin.tsx).
 */
export function ManualLocationStep({ draft, setDraft }: ManualLocationStepProps) {
  const location = draft.location;
  const pinLongitude = location?.longitude ?? DEFAULT_CENTER.longitude;
  const pinLatitude = location?.latitude ?? DEFAULT_CENTER.latitude;

  function updateLocation(longitude: number, latitude: number) {
    setDraft((current) => ({
      ...current,
      location: {
        latitude,
        longitude,
        accuracyMeters: null,
        altitudeMeters: null,
        headingDegrees: null,
        capturedAtClient: new Date().toISOString(),
        source: current.location?.source === "manual_address" ? "manual_address" : "manual_pin",
        manualAddress: current.location?.manualAddress ?? null,
      },
    }));
  }

  function updateCoordinateField(field: "latitude" | "longitude", value: string) {
    const numeric = Number.parseFloat(value);
    if (Number.isNaN(numeric)) return;
    updateLocation(
      field === "longitude" ? numeric : pinLongitude,
      field === "latitude" ? numeric : pinLatitude,
    );
  }

  function updateAddress(value: string) {
    setDraft((current) => ({
      ...current,
      location: {
        latitude: current.location?.latitude ?? pinLatitude,
        longitude: current.location?.longitude ?? pinLongitude,
        accuracyMeters: null,
        altitudeMeters: null,
        headingDegrees: null,
        capturedAtClient: new Date().toISOString(),
        source: "manual_address",
        manualAddress: value,
      },
    }));
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="font-sans text-sm text-on-surface-variant">
        Geser penanda pada peta ke lokasi kejadian, atau masukkan koordinat/alamat secara manual
        di bawah.
      </p>

      <MapPin longitude={pinLongitude} latitude={pinLatitude} draggable onPinMoved={updateLocation} />

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-sans text-sm font-medium text-on-surface">Lintang (Latitude)</span>
          <Input
            type="number"
            step="any"
            inputMode="decimal"
            value={location?.latitude ?? ""}
            onChange={(e) => updateCoordinateField("latitude", e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-sans text-sm font-medium text-on-surface">Bujur (Longitude)</span>
          <Input
            type="number"
            step="any"
            inputMode="decimal"
            value={location?.longitude ?? ""}
            onChange={(e) => updateCoordinateField("longitude", e.target.value)}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="font-sans text-sm font-medium text-on-surface">Alamat (opsional)</span>
        <Textarea
          placeholder="Contoh: Jl. Kebon Jeruk No. 12, RT 04/RW 02"
          value={location?.manualAddress ?? ""}
          onChange={(e) => updateAddress(e.target.value)}
        />
      </label>

      <p className="font-sans text-xs text-on-surface-variant">
        Lokasi yang ditandai secara manual memiliki tingkat keyakinan lebih rendah dibandingkan
        GPS dan akan ditandai demikian bagi tim verifikasi. Peta bersifat perkiraan visual —
        pastikan penanda berada sedekat mungkin dengan lokasi kejadian sebenarnya.
      </p>
    </div>
  );
}
