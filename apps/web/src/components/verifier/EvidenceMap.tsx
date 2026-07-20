"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { severityColors, type SeverityClass } from "@mboyo/ui";
import { getClientEnv } from "../../lib/env.client";

export interface EvidenceMapPin {
  reportId: string;
  longitude: number;
  latitude: number;
  severity: SeverityClass | null;
}

export interface EvidenceMapProps {
  pins: EvidenceMapPin[];
}

const FALLBACK_STYLE_URL = "https://demotiles.maplibre.org/style.json";

/**
 * Peta Bukti's multi-pin map (BLOCK 23) — distinct from
 * components/map/MapPin.tsx (a single-marker component for the Reporter's
 * manual-pin step and the Verifier's per-report location detail); this
 * renders one marker per report with a geolocation_observations row,
 * colored by predicted severity (packages/ui/src/tokens/colors.ts
 * severityColors, never an inline hex — same rule MapPin/SeverityBadge
 * already follow), clicking a pin navigates to that report's detail per
 * docs/product/SCREEN_INVENTORY.md's "tap pin -> navigate to detail"
 * requirement. Falls back to a plain message (never a hard crash) on
 * style/tile load failure, per RISK_REGISTER.md risk #7 — Semua Laporan
 * remains reachable via nav regardless of map health.
 */
export function EvidenceMap({ pins }: EvidenceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const router = useRouter();
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    let styleUrl = FALLBACK_STYLE_URL;
    try {
      styleUrl = getClientEnv().NEXT_PUBLIC_MAP_STYLE_URL ?? FALLBACK_STYLE_URL;
    } catch {
      // Degrade gracefully to the public demo style, never hard-fail.
    }

    const center: [number, number] =
      pins.length > 0 ? [pins[0]!.longitude, pins[0]!.latitude] : [117.0, -2.5]; // Indonesia-centered default.

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({ container: containerRef.current, style: styleUrl, center, zoom: pins.length > 0 ? 6 : 4 });
    } catch {
      setLoadError(true);
      return;
    }

    map.on("error", () => setLoadError(true));
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Deliberately empty deps — the map instance is created once on mount,
    // matching MapPin.tsx's own established pattern (see its identical
    // comment): pins are applied via the separate effect below rather than
    // tearing down and recreating the whole WebGL map on every re-render.
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const marker of markersRef.current) marker.remove();
    markersRef.current = [];

    for (const pin of pins) {
      const color = pin.severity ? severityColors[pin.severity] : severityColors.unknown;
      const marker = new maplibregl.Marker({ color })
        .setLngLat([pin.longitude, pin.latitude])
        .addTo(map);
      marker.getElement().style.cursor = "pointer";
      marker.getElement().addEventListener("click", () => {
        router.push(`/verifier/laporan/${pin.reportId}`);
      });
      markersRef.current.push(marker);
    }
  }, [pins, router]);

  if (loadError) {
    return (
      <div className="flex h-96 items-center justify-center rounded-md border border-brand-border bg-surface-container-lowest p-4 text-center">
        <p className="font-sans text-sm text-on-surface-variant">
          Peta tidak dapat dimuat saat ini. Gunakan{" "}
          <Link href="/verifier/laporan" className="underline">
            Semua Laporan
          </Link>{" "}
          untuk melihat daftar laporan.
        </p>
      </div>
    );
  }

  return <div ref={containerRef} className="h-96 w-full rounded-md md:h-[32rem]" />;
}
