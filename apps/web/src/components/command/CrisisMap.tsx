"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { priorityColors, severityColors, type PriorityLevel, type SeverityClass } from "@mboyo/ui";
import { getClientEnv } from "../../lib/env.client";

export interface CrisisMapReportPin {
  reportId: string;
  longitude: number;
  latitude: number;
  severity: SeverityClass | null;
}

export interface CrisisMapClusterPin {
  clusterId: string;
  longitude: number;
  latitude: number;
  priority: PriorityLevel;
  label: string;
  memberCount: number;
}

export interface CrisisMapProps {
  /** Standalone verified reports not already in a cluster. */
  reportPins: CrisisMapReportPin[];
  /** incident_clusters, rendered as distinct labeled markers. */
  clusterPins: CrisisMapClusterPin[];
  /** [lon,lat] outer ring, or null if the event has no geofence configured. */
  geofenceRingLonLat?: [number, number][] | null;
  showHeatLayer?: boolean;
  onBoundsChange?: (bbox: { minLon: number; minLat: number; maxLon: number; maxLat: number }) => void;
}

const FALLBACK_STYLE_URL = "https://demotiles.maplibre.org/style.json";
const REPORTS_SOURCE_ID = "mboyo-crisis-reports";
const HEAT_LAYER_ID = "mboyo-crisis-heat";
const CLUSTER_CIRCLE_LAYER_ID = "mboyo-crisis-clusters";
const CLUSTER_COUNT_LAYER_ID = "mboyo-crisis-cluster-count";
const UNCLUSTERED_LAYER_ID = "mboyo-crisis-unclustered";
const GEOFENCE_SOURCE_ID = "mboyo-crisis-geofence";

interface ReportPointFeatureCollection {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: { reportId: string; severity: string };
  }[];
}

/**
 * Peta Krisis's map (BLOCK 24) — distinct from BLOCK 23's EvidenceMap
 * (Verifier-only, no clustering/heat) and BLOCK 17's MapPin (single-marker
 * capture). Renders THREE distinct data layers over one MapLibre instance:
 * (1) a GeoJSON source of standalone verified report points with MapLibre's
 * native `cluster: true` (supercluster) for zoom-based visual grouping of
 * dense areas — the "clusters" a Coordinator sees at low zoom are a MapLibre
 * rendering detail, not incident_clusters rows; (2) incident_cluster
 * markers (plain maplibregl.Marker, colored by priorityColors, distinct
 * from the GeoJSON layer above) for the Coordinator's own deliberately
 * created operational groupings, each showing its label/member count; (3)
 * an optional heat layer toggled by the caller. Falls back to a plain
 * message on style/tile load failure — Peta Krisis's accessible list
 * fallback (this block's requirement) lives in the page component, not
 * here, so it remains visible even if this component never mounts at all.
 */
export function CrisisMap({
  reportPins,
  clusterPins,
  geofenceRingLonLat,
  showHeatLayer = false,
  onBoundsChange,
}: CrisisMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const clusterMarkersRef = useRef<maplibregl.Marker[]>([]);
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
      reportPins.length > 0 ? [reportPins[0]!.longitude, reportPins[0]!.latitude] : [117.0, -2.5];

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({ container: containerRef.current, style: styleUrl, center, zoom: reportPins.length > 0 ? 6 : 4 });
    } catch {
      setLoadError(true);
      return;
    }

    map.on("error", () => setLoadError(true));
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    if (onBoundsChange) {
      const reportBounds = () => {
        const bounds = map.getBounds();
        onBoundsChange({
          minLon: bounds.getWest(),
          minLat: bounds.getSouth(),
          maxLon: bounds.getEast(),
          maxLat: bounds.getNorth(),
        });
      };
      map.on("moveend", reportBounds);
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Deliberately empty deps — map instance created once on mount, matching
    // EvidenceMap.tsx/MapPin.tsx's identical established pattern; onBoundsChange
    // is captured once here rather than re-subscribed per prop identity change.
  }, []);

  // Standalone report pins — MapLibre native clustering + optional heat layer.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyReportsLayer = () => {
      if (!map.isStyleLoaded()) return;

      const geojson: ReportPointFeatureCollection = {
        type: "FeatureCollection",
        features: reportPins.map((pin) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [pin.longitude, pin.latitude] },
          properties: { reportId: pin.reportId, severity: pin.severity ?? "unknown" },
        })),
      };

      const existingSource = map.getSource<maplibregl.GeoJSONSource>(REPORTS_SOURCE_ID);
      if (existingSource) {
        existingSource.setData(geojson);
      } else {
        map.addSource(REPORTS_SOURCE_ID, {
          type: "geojson",
          data: geojson,
          cluster: true,
          clusterRadius: 50,
        });

        map.addLayer({
          id: CLUSTER_CIRCLE_LAYER_ID,
          type: "circle",
          source: REPORTS_SOURCE_ID,
          filter: ["has", "point_count"],
          paint: {
            "circle-color": severityColors.major_damage,
            "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 50, 28],
            "circle-opacity": 0.75,
          },
        });
        map.addLayer({
          id: CLUSTER_COUNT_LAYER_ID,
          type: "symbol",
          source: REPORTS_SOURCE_ID,
          filter: ["has", "point_count"],
          layout: { "text-field": "{point_count_abbreviated}", "text-size": 12 },
          paint: { "text-color": "#FFFFFF" },
        });
        map.addLayer({
          id: UNCLUSTERED_LAYER_ID,
          type: "circle",
          source: REPORTS_SOURCE_ID,
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": [
              "match",
              ["get", "severity"],
              "no_damage",
              severityColors.no_damage,
              "minor_damage",
              severityColors.minor_damage,
              "major_damage",
              severityColors.major_damage,
              "destroyed",
              severityColors.destroyed,
              severityColors.unknown,
            ],
            "circle-radius": 7,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#FFFFFF",
          },
        });

        map.on("click", UNCLUSTERED_LAYER_ID, (event) => {
          const feature = event.features?.[0];
          const reportId = feature?.properties?.reportId as string | undefined;
          if (reportId) router.push(`/command/tugas/baru?reportId=${reportId}`);
        });
        map.on("mouseenter", UNCLUSTERED_LAYER_ID, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", UNCLUSTERED_LAYER_ID, () => {
          map.getCanvas().style.cursor = "";
        });
      }
    };

    if (map.isStyleLoaded()) {
      applyReportsLayer();
    } else {
      void map.once("load", applyReportsLayer);
    }
  }, [reportPins, router]);

  // Heat layer — toggled independently of the clustered/unclustered layers above.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyHeatLayer = () => {
      if (!map.isStyleLoaded() || !map.getSource(REPORTS_SOURCE_ID)) return;
      if (map.getLayer(HEAT_LAYER_ID)) map.removeLayer(HEAT_LAYER_ID);

      if (showHeatLayer) {
        map.addLayer(
          {
            id: HEAT_LAYER_ID,
            type: "heatmap",
            source: REPORTS_SOURCE_ID,
            paint: {
              "heatmap-weight": 0.6,
              "heatmap-intensity": 1,
              "heatmap-radius": 30,
              "heatmap-opacity": 0.5,
            },
          },
          CLUSTER_CIRCLE_LAYER_ID,
        );
      }
    };

    if (map.isStyleLoaded()) {
      applyHeatLayer();
    } else {
      void map.once("load", applyHeatLayer);
    }
  }, [showHeatLayer, reportPins]);

  // incident_cluster markers — plain Markers, distinct from the GeoJSON supercluster layer above.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const marker of clusterMarkersRef.current) marker.remove();
    clusterMarkersRef.current = [];

    for (const cluster of clusterPins) {
      const element = document.createElement("div");
      element.style.display = "flex";
      element.style.alignItems = "center";
      element.style.justifyContent = "center";
      element.style.width = "2.25rem";
      element.style.height = "2.25rem";
      element.style.borderRadius = "9999px";
      element.style.border = "2px solid white";
      element.style.color = "white";
      element.style.fontSize = "0.75rem";
      element.style.fontWeight = "700";
      element.style.cursor = "pointer";
      element.style.backgroundColor = priorityColors[cluster.priority];
      element.textContent = String(cluster.memberCount);
      element.title = cluster.label;

      const marker = new maplibregl.Marker({ element }).setLngLat([cluster.longitude, cluster.latitude]).addTo(map);
      element.addEventListener("click", () => {
        router.push(`/command/prioritas?clusterId=${cluster.clusterId}`);
      });
      clusterMarkersRef.current.push(marker);
    }
  }, [clusterPins, router]);

  // Event boundary outline — same technique as components/map/MapPin.tsx's geofence effect.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyGeofence = () => {
      if (!map.isStyleLoaded()) return;
      if (map.getLayer(GEOFENCE_SOURCE_ID)) map.removeLayer(GEOFENCE_SOURCE_ID);
      if (map.getSource(GEOFENCE_SOURCE_ID)) map.removeSource(GEOFENCE_SOURCE_ID);

      if (!geofenceRingLonLat || geofenceRingLonLat.length < 3) return;

      map.addSource(GEOFENCE_SOURCE_ID, {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [geofenceRingLonLat] } },
      });
      map.addLayer({
        id: GEOFENCE_SOURCE_ID,
        type: "line",
        source: GEOFENCE_SOURCE_ID,
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
      <div className="flex h-96 items-center justify-center rounded-md border border-brand-border bg-surface-container-lowest p-4 text-center">
        <p className="font-sans text-sm text-on-surface-variant">
          Peta tidak dapat dimuat saat ini. Gunakan daftar aksesibel di bawah untuk melihat insiden dan klaster, atau
          kembali ke{" "}
          <Link href="/command" className="underline">
            Command Center
          </Link>
          .
        </p>
      </div>
    );
  }

  return <div ref={containerRef} className="h-96 w-full rounded-md md:h-[32rem]" />;
}
