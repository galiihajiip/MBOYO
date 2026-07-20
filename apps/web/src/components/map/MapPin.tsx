"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getClientEnv } from "../../lib/env.client";

/**
 * Shared MapLibre view for this block's two consumers: the Reporter's
 * manual-pin step (draggable=true) and the Verifier's location detail view
 * (draggable=false, showing the GPS accuracy circle). One component so the
 * "GeoJSON must use [longitude, latitude]" convention is enforced in
 * exactly one place — every prop/callback here is (longitude, latitude)
 * order, matching MapLibre's own [lng, lat] convention, never (lat, lng).
 *
 * Client-only by construction (imports maplibre-gl, which requires a
 * browser/WebGL context) — callers must dynamic-import this component with
 * ssr: false (see ManualLocationStep.tsx and the Verifier location view),
 * never import it directly into a Server Component tree.
 */
export interface MapPinProps {
  longitude: number;
  latitude: number;
  /** Meters — renders a translucent circle around the marker when set (GPS accuracy disclosure). */
  accuracyMeters?: number | null;
  draggable?: boolean;
  onPinMoved?: (longitude: number, latitude: number) => void;
  /** disaster_event geofence, as GeoJSON [lon, lat] ring coordinates — rendered as an outline when given. */
  geofenceRingLonLat?: [number, number][] | null;
  heightClassName?: string;
}

const FALLBACK_STYLE_URL = "https://demotiles.maplibre.org/style.json";

export function MapPin({
  longitude,
  latitude,
  accuracyMeters,
  draggable = false,
  onPinMoved,
  geofenceRingLonLat,
  heightClassName = "h-72",
}: MapPinProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    let styleUrl = FALLBACK_STYLE_URL;
    try {
      styleUrl = getClientEnv().NEXT_PUBLIC_MAP_STYLE_URL ?? FALLBACK_STYLE_URL;
    } catch {
      // Env validation failure — fall back to the public demo style rather
      // than failing the whole map (RISK_REGISTER.md risk #7 posture: the
      // map is an enhancement, degrade gracefully, don't hard-fail).
    }

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: styleUrl,
        center: [longitude, latitude],
        zoom: 15,
      });
    } catch {
      setLoadError(true);
      return;
    }

    map.on("error", () => setLoadError(true));
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    const marker = new maplibregl.Marker({ draggable, color: "#082032" })
      .setLngLat([longitude, latitude])
      .addTo(map);

    if (draggable && onPinMoved) {
      marker.on("dragend", () => {
        const { lng, lat } = marker.getLngLat();
        onPinMoved(lng, lat);
      });
    }

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Deliberately empty deps: the map instance is created once on mount;
    // subsequent longitude/latitude/accuracy/geofence changes are applied
    // via the separate effects below (setLngLat/easeTo, source updates)
    // rather than tearing down and recreating the whole WebGL map, which
    // would flash and reset the user's zoom/pan on every parent re-render.
  }, []);

  // Keep the marker/camera in sync with prop changes without re-creating
  // the whole map instance (which would flash/reset zoom on every parent
  // re-render).
  useEffect(() => {
    if (!markerRef.current || !mapRef.current) return;
    markerRef.current.setLngLat([longitude, latitude]);
    mapRef.current.easeTo({ center: [longitude, latitude] });
  }, [longitude, latitude]);

  // Accuracy circle — approximated as a GeoJSON polygon circle source/layer
  // rather than a fixed-pixel-radius marker, so it scales correctly with
  // the map's zoom/projection (a fixed-pixel circle would misrepresent the
  // real-world radius at any zoom level other than the one it was drawn at).
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const sourceId = "mboyo-accuracy-circle";
    const applyCircle = () => {
      if (!map.isStyleLoaded()) return;
      if (map.getLayer(sourceId)) map.removeLayer(sourceId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);

      if (!accuracyMeters || accuracyMeters <= 0) return;

      map.addSource(sourceId, { type: "geojson", data: circlePolygon(longitude, latitude, accuracyMeters) });
      map.addLayer({
        id: sourceId,
        type: "fill",
        source: sourceId,
        paint: { "fill-color": "#5AC8C8", "fill-opacity": 0.2 },
      });
    };

    if (map.isStyleLoaded()) {
      applyCircle();
    } else {
      void map.once("load", applyCircle);
    }
  }, [longitude, latitude, accuracyMeters]);

  // Geofence outline — advisory display only (see docs/security/THREAT_MODEL.md threat #3): shown for context, never blocks pin placement.
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const sourceId = "mboyo-geofence-outline";
    const applyGeofence = () => {
      if (!map.isStyleLoaded()) return;
      if (map.getLayer(sourceId)) map.removeLayer(sourceId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);

      if (!geofenceRingLonLat || geofenceRingLonLat.length < 3) return;

      map.addSource(sourceId, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "Polygon", coordinates: [geofenceRingLonLat] },
        },
      });
      map.addLayer({
        id: sourceId,
        type: "line",
        source: sourceId,
        paint: { "line-color": "#F4A300", "line-width": 2, "line-dasharray": [2, 2] },
      });
    };

    if (map.isStyleLoaded()) {
      applyGeofence();
    } else {
      void map.once("load", applyGeofence);
    }
  }, [geofenceRingLonLat]);

  if (loadError) {
    return (
      <div className={`flex ${heightClassName} items-center justify-center rounded-md border border-brand-border bg-surface-container-lowest p-4 text-center`}>
        <p className="font-sans text-sm text-on-surface-variant">
          Peta tidak dapat dimuat saat ini. Koordinat tetap tersimpan: {latitude.toFixed(6)}, {longitude.toFixed(6)}.
        </p>
      </div>
    );
  }

  return <div ref={containerRef} className={`${heightClassName} w-full rounded-md`} />;
}

interface CirclePolygonFeature {
  type: "Feature";
  properties: Record<string, never>;
  geometry: { type: "Polygon"; coordinates: [number, number][][] };
}

/** Approximates a circle of `radiusMeters` around [lon, lat] as a GeoJSON Polygon — [longitude, latitude] order throughout, per this block's requirement. */
function circlePolygon(
  longitude: number,
  latitude: number,
  radiusMeters: number,
  points = 64,
): CirclePolygonFeature {
  const coords: [number, number][] = [];
  const earthRadiusMeters = 6378137;
  const latRad = (latitude * Math.PI) / 180;

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);
    const deltaLon = (dx / (earthRadiusMeters * Math.cos(latRad))) * (180 / Math.PI);
    const deltaLat = (dy / earthRadiusMeters) * (180 / Math.PI);
    coords.push([longitude + deltaLon, latitude + deltaLat]);
  }

  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [coords] },
  };
}
