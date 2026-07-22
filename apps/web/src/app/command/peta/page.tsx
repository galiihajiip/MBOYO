import type { Metadata } from "next";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { listCommandMapReports, getDisasterEventGeofenceRing } from "../../../lib/command/map";
import { listClusterSummaries } from "../../../lib/command/clusters";
import { CrisisMapClient } from "../../../components/command/CrisisMapClient";
import { CrisisMapFilters } from "../../../components/command/CrisisMapFilters";
import { CrisisMapListFallback } from "../../../components/command/CrisisMapListFallback";
import type { CrisisMapClusterPin, CrisisMapReportPin } from "../../../components/command/CrisisMap";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Peta Krisis — MBOYO" };

interface SearchParams {
  [key: string]: string | string[] | undefined;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Peta Krisis (BLOCK 24) — the Coordinator's crisis map: verified/escalated
 * data only (public.command_map_reports/command_cluster_summary are both
 * already scoped to verified reports), severity markers + MapLibre native
 * clustering, incident_cluster markers, an optional heat layer, an event
 * boundary outline (when configured), and an always-visible accessible list
 * fallback per this block's explicit requirement. Bbox-scoped viewport
 * queries are deferred to client-side re-fetching via onBoundsChange in a
 * future refinement — this initial load fetches every verified report with
 * a location (bounded, small dataset at current scale), matching Peta
 * Bukti's (BLOCK 23) same "fetch up to 100, no viewport paging yet" scope.
 */
export default async function PetaKrisisPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();

  const severityFilter = first(params.severity);
  const clusterPriorityFilter = first(params.clusterPriority);
  const showHeatLayer = first(params.heat) === "true";

  const [allReports, allClusters] = await Promise.all([
    listCommandMapReports(supabase),
    listClusterSummaries(supabase),
  ]);

  const filteredReports = severityFilter
    ? allReports.filter((report) => report.topSeverity === severityFilter)
    : allReports;
  const standaloneReports = filteredReports.filter((report) => report.incidentClusterId === null);

  const filteredClusters = clusterPriorityFilter
    ? allClusters.filter((cluster) => cluster.priority === clusterPriorityFilter)
    : allClusters;
  const clustersWithLocation = filteredClusters.filter(
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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-sans text-2xl font-bold text-on-surface">Peta Krisis</h1>
        <p className="mt-1 font-sans text-sm text-on-surface-variant">
          {filteredReports.length} laporan terverifikasi · {clustersWithLocation.length} klaster insiden.
        </p>
      </div>
      <CrisisMapFilters />
      <CrisisMapClient
        reportPins={reportPins}
        clusterPins={clusterPins}
        geofenceRingLonLat={geofenceRing}
        showHeatLayer={showHeatLayer}
      />
      <CrisisMapListFallback reports={filteredReports} clusters={clustersWithLocation} />
    </div>
  );
}
