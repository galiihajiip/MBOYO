-- BLOCK 24 — Coordinator Command Center map/dashboard views. Both are
-- security_invoker (per BLOCK 23's verifier_report_queue precedent) so they
-- add zero new authorization surface: every underlying row is already
-- exactly what reports_coordinator_select_verified /
-- incident_clusters_coordinator_all / response_tasks_coordinator_all let a
-- Coordinator see today. A Verifier/Auditor querying these views sees
-- their own already-narrower RLS-filtered subset, same as any other
-- security_invoker view in this codebase.

-- ============================================================================
-- command_map_reports — one row per verified report with a recorded
-- location, its latest predicted severity, and whether it's already inside
-- a cluster (so the map can render clustered reports differently from
-- standalone pins). Mirrors BLOCK 23's verifier_report_queue LATERAL-join
-- pattern for "latest child row."
-- ============================================================================

create view public.command_map_reports
with (security_invoker = true)
as
select
  r.id,
  r.disaster_event_id,
  r.description,
  r.escalated,
  r.submitted_at,
  go.longitude,
  go.latitude,
  latest_prediction.top_severity,
  cm.incident_cluster_id
from public.reports r
join lateral (
  select go.longitude, go.latitude
  from public.geolocation_observations go
  where go.report_id = r.id
  order by go.created_at desc
  limit 1
) as go on true
left join lateral (
  select
    (
      select key
      from jsonb_each_text(mp.severity_probabilities) as kv(key, value)
      order by value::numeric desc
      limit 1
    ) as top_severity
  from public.model_predictions mp
  where mp.report_id = r.id
  order by mp.created_at desc
  limit 1
) as latest_prediction on true
left join public.cluster_members cm on cm.report_id = r.id
where r.status = 'verified';

grant select on public.command_map_reports to authenticated;

comment on view public.command_map_reports is
  'Verified reports with a recorded location, for the Peta Krisis map — security_invoker, RLS on reports/geolocation_observations/model_predictions still governs visibility exactly as it does today.';

-- ============================================================================
-- command_cluster_summary — one row per incident_cluster with its member
-- count, severity mix (jsonb histogram), verified-evidence count, related
-- (non-cancelled) task count, and a computed centroid for map placement.
-- ============================================================================

create view public.command_cluster_summary
with (security_invoker = true)
as
with member_reports as (
  select
    cm.incident_cluster_id,
    cm.report_id,
    go.longitude,
    go.latitude,
    (
      select key
      from jsonb_each_text(mp.severity_probabilities) as kv(key, value)
      order by value::numeric desc
      limit 1
    ) as top_severity,
    (
      select count(*) from public.report_evidence re where re.report_id = cm.report_id
    ) as evidence_count
  from public.cluster_members cm
  left join lateral (
    select go.longitude, go.latitude
    from public.geolocation_observations go
    where go.report_id = cm.report_id
    order by go.created_at desc
    limit 1
  ) as go on true
  left join lateral (
    select mp.severity_probabilities
    from public.model_predictions mp
    where mp.report_id = cm.report_id
    order by mp.created_at desc
    limit 1
  ) as mp on true
),
member_aggregates as (
  select
    incident_cluster_id,
    count(distinct report_id) as member_count,
    coalesce(jsonb_object_agg(top_severity, severity_count) filter (where top_severity is not null), '{}'::jsonb) as severity_mix,
    sum(evidence_count) as evidence_count,
    avg(longitude) as centroid_longitude,
    avg(latitude) as centroid_latitude
  from (
    select
      incident_cluster_id,
      report_id,
      longitude,
      latitude,
      top_severity,
      evidence_count,
      count(*) over (partition by incident_cluster_id, top_severity) as severity_count
    from member_reports
  ) as with_counts
  group by incident_cluster_id
)
select
  c.id,
  c.disaster_event_id,
  c.label,
  c.priority,
  c.created_at,
  coalesce(a.member_count, 0) as member_count,
  coalesce(a.severity_mix, '{}'::jsonb) as severity_mix,
  coalesce(a.evidence_count, 0) as evidence_count,
  a.centroid_longitude,
  a.centroid_latitude,
  coalesce(task_stats.task_count, 0) as task_count
from public.incident_clusters c
left join member_aggregates a on a.incident_cluster_id = c.id
left join lateral (
  select count(*) as task_count
  from public.response_tasks rt
  where rt.incident_cluster_id = c.id
    and rt.status <> 'cancelled'
) as task_stats on true;

grant select on public.command_cluster_summary to authenticated;

comment on view public.command_cluster_summary is
  'incident_clusters joined with member/severity-mix/evidence/task aggregates and a computed centroid, for the Peta Krisis and Prioritas screens.';

-- ============================================================================
-- command_dashboard_metrics — one row (no grouping key; the whole view is
-- always exactly one row) with the six Ringkasan metrics this block's
-- prompt requires. security_invoker over reports/incident_clusters/
-- response_tasks exactly as above. Median response time uses
-- percentile_cont(0.5) over completed tasks' created_at->closed_at
-- duration — a provisional, disclosed choice: it only reflects tasks that
-- have actually reached 'completed' (excludes cancelled/still-open tasks),
-- since there is no other "response time" concept recorded anywhere in
-- this schema.
-- ============================================================================

create view public.command_dashboard_metrics
with (security_invoker = true)
as
select
  (select count(*) from public.reports where status = 'verified') as verified_incident_count,
  (select count(*) from public.incident_clusters where priority = 'critical') as critical_cluster_count,
  (select count(*) from public.response_tasks where priority = 'unassigned' and status not in ('completed', 'cancelled')) as unassigned_priority_count,
  (select count(*) from public.response_tasks where status in ('assigned', 'acknowledged', 'in_progress', 'blocked')) as active_task_count,
  (select count(*) from public.response_tasks where due_at is not null and due_at < now() and status not in ('completed', 'cancelled')) as overdue_task_count,
  (
    select percentile_cont(0.5) within group (order by extract(epoch from (closed_at - created_at)))
    from public.response_tasks
    where status = 'completed' and closed_at is not null
  ) as median_response_time_seconds;

grant select on public.command_dashboard_metrics to authenticated;

comment on view public.command_dashboard_metrics is
  'The six Ringkasan (Command Center dashboard) metrics — verified incidents, critical clusters, unassigned-priority tasks, active tasks, overdue tasks, median response time in seconds (completed tasks only, provisional).';

-- ============================================================================
-- disaster_event_geofence_geojson — returns a disaster_event's geofence
-- polygon as GeoJSON text, or null if none is configured. Event geofence
-- configuration itself remains an Admin-block stub (apps/web/src/app/admin/event/page.tsx)
-- — this function exists so Peta Krisis can render whichever events DO
-- already have one seeded, without requiring PostgREST to serialize a raw
-- PostGIS geography type (which it cannot do directly).
-- ============================================================================

create function public.disaster_event_geofence_geojson(p_disaster_event_id uuid)
returns text
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select st_asgeojson(geofence::geometry)
  from public.disaster_events
  where id = p_disaster_event_id and geofence is not null;
$$;

grant execute on function public.disaster_event_geofence_geojson(uuid) to authenticated;

comment on function public.disaster_event_geofence_geojson(uuid) is
  'A disaster_event''s geofence polygon as GeoJSON text, or null if unset — security invoker, RLS on disaster_events (read access shared by all authenticated roles) still applies.';
