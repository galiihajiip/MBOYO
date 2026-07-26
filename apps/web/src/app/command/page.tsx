import type { Metadata } from "next";
import Link from "next/link";
import { MetricCard } from "@mboyo/ui";
import { getCurrentUser } from "../../lib/auth/server";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import { getCommandDashboardMetrics } from "../../lib/command/dashboard";
import { listCommandMapReports, getDisasterEventGeofenceRing } from "../../lib/command/map";
import { listClusterSummaries } from "../../lib/command/clusters";
import { CommandHomeClient } from "../../components/command/CommandHomeClient";
import type { CrisisMapClusterPin, CrisisMapReportPin } from "../../components/command/CrisisMap";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Command Center — MBOYO" };

function formatResponseTime(seconds: number | null): string {
  if (seconds === null) return "—";
  const hours = seconds / 3600;
  if (hours < 1) return `${Math.round(seconds / 60)} menit`;
  return `${hours.toFixed(1)} jam`;
}

interface DisasterEventNameRow {
  id: string;
  name: string;
}

/**
 * Keyword match on real disaster_events.name (e.g. "Banjir Jakarta Selatan
 * — Demo", "Gempa Bumi Cianjur — Demo") — this dataset has no disaster
 * "type" column, only a free-text name, but the seeded names consistently
 * start with the Indonesian disaster-type term, so this is a real
 * classification of real event names rather than fabricated data.
 */
function classifyEventName(name: string): "flood" | "seismic" | "other" {
  const lower = name.toLowerCase();
  if (lower.startsWith("banjir")) return "flood";
  if (lower.startsWith("gempa") || lower.startsWith("erupsi") || lower.startsWith("longsor")) return "seismic";
  return "other";
}

/**
 * Command Center Beranda (BLOCK 24, redesigned per the Coordinator "Crisis
 * Response HQ" mockup) — map-first layout replacing the earlier plain
 * metric-card grid. Reuses Peta Krisis's exact data fetchers
 * (listCommandMapReports/listClusterSummaries/getDisasterEventGeofenceRing)
 * and CrisisMapClient so the Beranda map and the dedicated /command/peta
 * map never drift into two different queries for "what's verified right
 * now." The six original Ringkasan metrics remain, now as a slim row above
 * the map instead of the page's sole content, preserving every existing
 * downstream link (each still routes to its pre-filtered screen).
 */
export default async function CommandCenterPage() {
  const user = await getCurrentUser();
  const supabase = await createServerSupabaseClient();

  const [metrics, allReports, allClusters, eventRows] = await Promise.all([
    getCommandDashboardMetrics(supabase),
    listCommandMapReports(supabase),
    listClusterSummaries(supabase),
    supabase
      .from("disaster_events")
      .select("id, name")
      .then((res) => (res.data ?? []) as DisasterEventNameRow[]),
  ]);

  const eventTypeById = new Map(eventRows.map((event) => [event.id, classifyEventName(event.name)]));
  const floodCount = allReports.filter((r) => eventTypeById.get(r.disasterEventId) === "flood").length;
  const seismicCount = allReports.filter((r) => eventTypeById.get(r.disasterEventId) === "seismic").length;

  const standaloneReports = allReports.filter((report) => report.incidentClusterId === null);
  const clustersWithLocation = allClusters.filter(
    (cluster) => cluster.centroidLongitude !== null && cluster.centroidLatitude !== null,
  );

  const geofenceRing =
    allReports.length > 0 ? await getDisasterEventGeofenceRing(supabase, allReports[0]!.disasterEventId) : null;

  const reportPins: CrisisMapReportPin[] = standaloneReports.map((report) => ({
    reportId: report.id,
    longitude: report.longitude,
    latitude: report.latitude,
    severity: report.topSeverity,
  }));

  const clusterPins: CrisisMapClusterPin[] = clustersWithLocation.map((cluster) => ({
    clusterId: cluster.id,
    longitude: cluster.centroidLongitude!,
    latitude: cluster.centroidLatitude!,
    priority: cluster.priority,
    label: cluster.label,
    memberCount: cluster.memberCount,
  }));

  const recentReports = [...allReports].sort((a, b) => {
    const at = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const bt = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    return bt - at;
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-sans text-2xl font-bold text-on-surface">Selamat datang, {user?.displayName}</h1>
        <p className="mt-2 font-sans text-sm text-on-surface-variant">
          Insiden terverifikasi yang memerlukan perhatian dan ringkasan tugas respons aktif.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Link href="/command/peta">
          <MetricCard label="Insiden Terverifikasi" value={metrics.verifiedIncidentCount} />
        </Link>
        <Link href="/command/prioritas?priority=critical">
          <MetricCard label="Klaster Kritis" value={metrics.criticalClusterCount} />
        </Link>
        <Link href="/command/tugas?priority=unassigned">
          <MetricCard label="Prioritas Belum Ditentukan" value={metrics.unassignedPriorityCount} />
        </Link>
        <Link href="/command/tugas?status=in_progress">
          <MetricCard label="Tugas Aktif" value={metrics.activeTaskCount} />
        </Link>
        <Link href="/command/tugas?overdueOnly=true">
          <MetricCard
            label="Tugas Terlambat"
            value={metrics.overdueTaskCount}
            trend={metrics.overdueTaskCount > 0 ? { direction: "down", label: "Melewati batas waktu" } : undefined}
          />
        </Link>
        <MetricCard label="Median Waktu Respons" value={formatResponseTime(metrics.medianResponseTimeSeconds)} />
      </div>

      <CommandHomeClient
        reportPins={reportPins}
        clusterPins={clusterPins}
        geofenceRingLonLat={geofenceRing}
        recentReports={recentReports}
        floodCount={floodCount}
        seismicCount={seismicCount}
      />
    </div>
  );
}
