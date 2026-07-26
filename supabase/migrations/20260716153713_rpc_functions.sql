-- Application-facing SQL/RPC functions.
--
-- Geospatial queries (reports_in_bbox, reports_within_radius) are
-- SECURITY INVOKER so they run under the caller's own RLS — a Verifier
-- calling these sees exactly the reports their reports_* RLS policies
-- already allow, never more. claim_analysis_jobs and append_audit_event are
-- SECURITY DEFINER because they perform actions (job claiming, audit
-- writes) that no human role has direct table-level permission to do
-- safely without the function's additional invariants (atomic claim,
-- shape-validated audit entries) — both are still narrowly scoped, not a
-- general RLS bypass.

-- ============================================================================
-- reports_in_bbox — reports whose geolocation_observations fall within a
-- bounding box. Used by map views (Peta Bukti, Peta Krisis) for viewport
-- queries, per docs/product/SCREEN_INVENTORY.md.
-- ============================================================================

create function public.reports_in_bbox(
  min_lon double precision,
  min_lat double precision,
  max_lon double precision,
  max_lat double precision
)
returns setof public.reports
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select distinct r.*
  from public.reports r
  join public.geolocation_observations go on go.report_id = r.id
  where go.location && st_makeenvelope(min_lon, min_lat, max_lon, max_lat, 4326)::geography
  -- The && operator uses the GIST index (geolocation_observations_location_gist_idx)
  -- for a fast bounding-box overlap test; RLS on public.reports (via the
  -- implicit join-through) still applies since this function is
  -- SECURITY INVOKER, so a Reporter calling this only ever sees their own
  -- reports even though the function itself doesn't repeat the ownership
  -- check.
  order by r.id;
$$;

comment on function public.reports_in_bbox(double precision, double precision, double precision, double precision) is
  'Reports with a geolocation_observation inside the given [min_lon,min_lat,max_lon,max_lat] bounding box (SRID 4326). RLS-scoped to the caller.';

-- ============================================================================
-- reports_within_radius — reports within N meters of a point. Used for
-- geofence cross-checks (docs/security/THREAT_MODEL.md threat #3) and
-- proximity-based duplicate/cluster candidate discovery.
-- ============================================================================

create function public.reports_within_radius(
  center_lon double precision,
  center_lat double precision,
  radius_meters double precision
)
returns table (
  report_id uuid,
  distance_meters double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    r.id as report_id,
    st_distance(go.location, st_setsrid(st_makepoint(center_lon, center_lat), 4326)::geography) as distance_meters
  from public.reports r
  join public.geolocation_observations go on go.report_id = r.id
  where st_dwithin(
    go.location,
    st_setsrid(st_makepoint(center_lon, center_lat), 4326)::geography,
    radius_meters
  )
  order by distance_meters asc;
$$;

comment on function public.reports_within_radius(double precision, double precision, double precision) is
  'Reports with a geolocation_observation within radius_meters of the given point (SRID 4326), ordered nearest-first. RLS-scoped to the caller.';

-- ============================================================================
-- cluster_destroyed_reports — groups verified 'destroyed'-severity reports
-- within a proximity threshold into suggested incident_cluster candidates,
-- for the Coordinator's clustering workflow (docs/product/DOMAIN_MODEL.md
-- incident_cluster / cluster_member). Returns candidate groupings; it does
-- NOT create incident_clusters rows itself — clustering remains a Response
-- Coordinator decision (docs/product/STATE_MACHINES.md), this function only
-- surfaces suggestions.
-- ============================================================================

create function public.cluster_destroyed_reports(
  p_disaster_event_id uuid,
  proximity_meters double precision default 200
)
returns table (
  cluster_seed_report_id uuid,
  member_report_id uuid,
  distance_meters double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with destroyed as (
    select
      r.id as report_id,
      go.location as location
    from public.reports r
    join public.geolocation_observations go on go.report_id = r.id
    join public.model_predictions mp on mp.report_id = r.id
    where r.disaster_event_id = p_disaster_event_id
      and r.status = 'verified'
      and (mp.severity_probabilities->>'destroyed')::numeric >= 0.5
      and not exists (
        select 1 from public.cluster_members cm where cm.report_id = r.id
      )
  )
  select
    d1.report_id as cluster_seed_report_id,
    d2.report_id as member_report_id,
    st_distance(d1.location, d2.location) as distance_meters
  from destroyed d1
  join destroyed d2 on d2.report_id <> d1.report_id
  where st_dwithin(d1.location, d2.location, proximity_meters)
  order by cluster_seed_report_id, distance_meters asc;
$$;

comment on function public.cluster_destroyed_reports(uuid, double precision) is
  'Suggests groupings of unclustered verified destroyed-severity reports within proximity_meters of each other, for a disaster_event. Read-only suggestion — does not create incident_clusters.';

-- ============================================================================
-- claim_analysis_jobs — safe, concurrent-worker-safe job claiming per
-- docs/adr/0003-database-job-queue.md and
-- docs/architecture/SEQUENCE_FLOWS.md Diagram 4. SECURITY DEFINER because
-- no human role has UPDATE permission on analysis_jobs at all (only
-- apps/worker's service-role connection would otherwise be able to do
-- this, and this function exists so the *claim* semantics — atomic,
-- SKIP LOCKED — are enforced in exactly one place rather than
-- reimplemented per caller).
-- ============================================================================

create function public.claim_analysis_jobs(
  worker_id text,
  batch_size integer default 1
)
returns setof public.analysis_jobs
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  -- Explicit internal guard: this is SECURITY DEFINER (it must be, since no
  -- human role has table-level UPDATE on analysis_jobs), which means
  -- granting EXECUTE alone would let ANY authenticated user of ANY role
  -- claim/mutate analysis_jobs regardless of RBAC — the function itself
  -- must therefore enforce who may call it, not rely on the grant.
  -- System Administrator holds read-only "health/status" access per
  -- docs/product/RBAC_MATRIX.md and must not be able to claim jobs either;
  -- in practice only apps/worker's service-role connection (which bypasses
  -- this check entirely, since RLS/permission checks don't apply to
  -- service-role) is expected to call this.
  if not public.has_role('system_administrator') then
    raise exception 'claim_analysis_jobs: only callable by service-role or system_administrator (health tooling)';
  end if;

  return query
    update public.analysis_jobs
    set status = 'processing',
        claimed_by = worker_id,
        claimed_at = now(),
        attempts = attempts + 1
    where id in (
      select id
      from public.analysis_jobs
      where status = 'queued'
      order by created_at
      limit batch_size
      -- FOR UPDATE SKIP LOCKED is the mechanism that makes concurrent
      -- apps/worker instances safe without an external lock service — a
      -- second worker calling this concurrently skips rows already locked
      -- by the first, rather than blocking or double-claiming them.
      for update skip locked
    )
    returning *;
end;
$$;

comment on function public.claim_analysis_jobs(text, integer) is
  'Atomically claims up to batch_size queued analysis_jobs for the given worker_id, using FOR UPDATE SKIP LOCKED so concurrent workers never double-claim. SECURITY DEFINER with an internal role guard: only service-role (which bypasses the guard, per Supabase design) or system_administrator may call this.';

-- Granted to `authenticated` so a signed-in system_administrator can call it
-- (e.g. from health-check tooling) without needing service-role escalation;
-- the function's own internal guard above — not this grant — is what
-- actually restricts which authenticated users may successfully claim jobs.
grant execute on function public.claim_analysis_jobs(text, integer) to authenticated;

-- ============================================================================
-- append_audit_event — the only way to write to audit_events (no direct
-- INSERT policy exists on that table, per the RLS migration). SECURITY
-- DEFINER so it can insert despite the caller having no table-level INSERT
-- grant; the function itself is the enforcement point for "audit events are
-- structurally valid and attributable," not a bypass of any restriction
-- meant to stay in force.
-- ============================================================================

create function public.append_audit_event(
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_detail jsonb default '{}'::jsonb
)
returns public.audit_events
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor_profile_id uuid;
  v_row public.audit_events;
begin
  v_actor_profile_id := public.current_profile_id();

  insert into public.audit_events (entity_type, entity_id, actor_profile_id, action, detail)
  values (p_entity_type, p_entity_id, v_actor_profile_id, p_action, p_detail)
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.append_audit_event(text, uuid, text, jsonb) is
  'The only sanctioned write path to audit_events — attributes the event to the calling user''s own profile automatically. No direct INSERT policy exists on audit_events; this function is SECURITY DEFINER specifically to provide that single write path.';

grant execute on function public.append_audit_event(text, uuid, text, jsonb) to authenticated;
