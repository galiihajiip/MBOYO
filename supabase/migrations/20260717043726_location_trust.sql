-- ============================================================================
-- Location trust: source/manual-address columns, geofence distance +
-- suspicious-pattern advisory signal, reverse-geocode cache (BLOCK 17)
-- ============================================================================
-- geolocation_observations (BLOCK 08) was narrower than the client-side
-- ReportDraft.location shape (apps/web/src/lib/reports/types.ts) — it had
-- no way to record HOW a location was obtained (GPS vs. manual map pin vs.
-- manual address) or a free-text manual address. This migration closes
-- that gap and adds the server-side advisory signal computation this
-- block requires, per docs/security/THREAT_MODEL.md threat #3: "location
-- confidence signal (not blind trust)... cross-check against event
-- geofence as an additional signal, not an auto-accept/reject gate."

-- See 20260716153709_core_schema.sql's identical comment: Cloud projects
-- don't always default this migration role's session search_path to
-- include `extensions`, so unqualified geometry/geography references below
-- (st_x/st_y casts) fail without this.
set search_path = public, extensions;

create type public.location_source as enum ('gps', 'manual_pin', 'manual_address');

alter table public.geolocation_observations
  add column location_source public.location_source not null default 'gps',
  add column manual_address text,
  -- Distance in meters from this observation to the owning report's
  -- disaster_event geofence centroid — null when the event has no geofence
  -- configured (nothing to compare against) or the observation predates
  -- this migration. Computed once at insert time by record_geolocation_observation()
  -- below, not on every read, so a Verifier's list/detail view never pays
  -- a live PostGIS computation cost.
  add column distance_to_event_center_meters numeric(12, 2),
  -- True when this observation falls outside the event's geofence polygon
  -- (only meaningful when the event has a geofence at all) — an advisory
  -- flag for the Verifier UI, never a rejection: see threat #3's explicit
  -- "not an auto-accept/reject gate."
  add column outside_event_boundary boolean,
  -- Advisory-only pattern flags for human review — e.g. "identical
  -- coordinates as another recent observation from the same reporter"
  -- (possible stale/cached fix), "zero accuracy_meters with GPS source"
  -- (implausible), "manual pin far outside any event geofence". This is a
  -- jsonb array of short string codes, not a boolean/score, so new flag
  -- types can be added without a migration, and the Verifier UI can render
  -- each flag as a distinct, explained warning rather than one opaque
  -- number. Per this block's explicit requirement: "suspicious-pattern
  -- flags for human review, not automatic rejection" — nothing reads this
  -- column to reject/auto-hide a report; it is display-only signal.
  add column suspicious_pattern_flags jsonb not null default '[]'::jsonb;

comment on column public.geolocation_observations.location_source is
  'How this observation was obtained: device GPS, a manually placed map pin, or a manually typed address. Never inferred after the fact — set explicitly by the client at capture time.';
comment on column public.geolocation_observations.outside_event_boundary is
  'Advisory only (docs/security/THREAT_MODEL.md threat #3) — true if outside the disaster_event geofence. Never used to auto-reject; null when the event has no geofence to check against.';
comment on column public.geolocation_observations.suspicious_pattern_flags is
  'Advisory-only jsonb array of flag codes for Verifier review (e.g. "duplicate_coordinates", "implausible_accuracy"). Never causes automatic rejection — see docs/security/THREAT_MODEL.md threat #3.';

-- geography(Point) does not expose raw x/y through an ordinary PostgREST
-- column select (the client library has no PostGIS-aware decoder) — these
-- generated columns re-expose the same point's coordinates as plain
-- double precision so apps/web's domain-service layer (and, transitively,
-- the Verifier map display and any future GeoJSON export) can select them
-- directly. Named longitude/latitude (not x/y or lon/lat abbreviated) to
-- keep the [longitude, latitude] ordering this block requires unambiguous
-- at every call site that reads these two columns.
alter table public.geolocation_observations
  add column longitude double precision generated always as (st_x(location::geometry)) stored,
  add column latitude double precision generated always as (st_y(location::geometry)) stored;

comment on column public.geolocation_observations.longitude is
  'Generated from location (geography Point) via st_x — always the FIRST coordinate read/written together with latitude, per this block''s "GeoJSON must use [longitude, latitude]" requirement.';
comment on column public.geolocation_observations.latitude is
  'Generated from location (geography Point) via st_y.';

-- ============================================================================
-- record_geolocation_observation — the only sanctioned insert path
-- ============================================================================
-- SECURITY DEFINER (like append_audit_event/claim_analysis_jobs before it)
-- so it can compute distance-to-geofence-centroid and suspicious-pattern
-- flags server-side in the same statement as the insert, using data
-- (other reports' recent observations, the event's geofence) the
-- inserting Reporter's own RLS grants don't otherwise expose — the
-- function itself is the trust boundary, not a general RLS bypass: it
-- still requires public.owns_report(p_report_id) internally, mirroring
-- the geolocation_observations_reporter_insert_own RLS policy's own check
-- (BLOCK 08), so a Reporter can still only ever record an observation for
-- their own report.

create function public.record_geolocation_observation(
  p_report_id uuid,
  p_longitude double precision,
  p_latitude double precision,
  p_accuracy_meters numeric default null,
  p_captured_at_client timestamptz default null,
  p_location_source public.location_source default 'gps',
  p_manual_address text default null
)
returns public.geolocation_observations
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_point geography(Point, 4326);
  v_event_id uuid;
  v_geofence geography(Polygon, 4326);
  v_distance_to_center numeric(12, 2);
  v_outside_boundary boolean;
  v_flags jsonb := '[]'::jsonb;
  v_duplicate_count integer;
  v_confidence numeric(4, 3);
  v_row public.geolocation_observations;
begin
  if not public.owns_report(p_report_id) then
    raise exception 'record_geolocation_observation: caller does not own report %', p_report_id using errcode = '42501';
  end if;

  -- GeoJSON/PostGIS point construction is [longitude, latitude] order —
  -- st_makepoint(x, y) takes (lon, lat), matching this block's explicit
  -- "GeoJSON must use [longitude, latitude]" requirement; getting this
  -- backwards would silently place every point in the wrong hemisphere on
  -- most reports (lat/lon magnitudes overlap near the equator, so this
  -- bug would NOT be obviously wrong-looking for many real coordinates).
  if p_longitude < -180 or p_longitude > 180 or p_latitude < -90 or p_latitude > 90 then
    raise exception 'record_geolocation_observation: coordinates out of range (lon=%, lat=%)', p_longitude, p_latitude
      using errcode = '22023';
  end if;

  v_point := st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography;

  select disaster_event_id into v_event_id from public.reports where id = p_report_id;
  select geofence into v_geofence from public.disaster_events where id = v_event_id;

  if v_geofence is not null then
    v_distance_to_center := st_distance(v_point, st_centroid(v_geofence::geometry)::geography);
    v_outside_boundary := not st_within(v_point::geometry, v_geofence::geometry);
  else
    v_distance_to_center := null;
    v_outside_boundary := null;
  end if;

  -- Suspicious-pattern flags — advisory only, per this function's header
  -- comment and the column comment above. Each check below is a coarse,
  -- explainable heuristic, not a definitive fraud signal.
  if p_location_source = 'gps' and p_accuracy_meters is not null and p_accuracy_meters <= 0 then
    v_flags := v_flags || jsonb_build_array('implausible_accuracy');
  end if;

  if v_outside_boundary then
    v_flags := v_flags || jsonb_build_array('outside_event_boundary');
  end if;

  -- Same reporter, same report, an already-recorded observation within 1
  -- meter — likely a re-submitted/cached fix rather than a genuine retry
  -- with a materially different position; flagged, never blocked (a
  -- Reporter retrying GPS in the same spot is completely normal).
  select count(*) into v_duplicate_count
  from public.geolocation_observations go
  where go.report_id = p_report_id
    and st_dwithin(go.location, v_point, 1);
  if v_duplicate_count > 0 then
    v_flags := v_flags || jsonb_build_array('duplicate_coordinates');
  end if;

  -- confidence_signal (BLOCK 08 column, unpopulated until now): a coarse
  -- 0..1 signal for the Verifier's ConfidenceMeter
  -- (packages/ui/src/primitives/ConfidenceMeter.tsx, already built for
  -- "location confidence" per its own doc comment), NOT a claim of
  -- accuracy or truth — per this block's explicit "Never describe GPS as
  -- guaranteed truth" requirement, this number only reflects how much
  -- corroborating signal exists (source type, device-reported accuracy,
  -- event-boundary agreement), never a probability that the location is
  -- correct. Starts at a source-based baseline, then adjusted by
  -- observable signals — deliberately simple/explainable arithmetic, not
  -- a model, so a Verifier or Auditor can reconstruct why a given value
  -- was produced from the same row's other columns.
  v_confidence := case p_location_source
    when 'gps' then 0.700
    when 'manual_pin' then 0.400
    when 'manual_address' then 0.250
  end;
  if p_location_source = 'gps' and p_accuracy_meters is not null then
    if p_accuracy_meters <= 20 then
      v_confidence := least(1.000, v_confidence + 0.200);
    elsif p_accuracy_meters <= 50 then
      v_confidence := least(1.000, v_confidence + 0.100);
    elsif p_accuracy_meters > 200 then
      v_confidence := greatest(0.000, v_confidence - 0.200);
    end if;
  end if;
  if v_outside_boundary then
    v_confidence := greatest(0.000, v_confidence - 0.250);
  end if;
  if v_duplicate_count > 0 then
    v_confidence := greatest(0.000, v_confidence - 0.100);
  end if;

  insert into public.geolocation_observations (
    report_id, location, accuracy_meters, captured_at_client,
    location_source, manual_address, distance_to_event_center_meters,
    outside_event_boundary, suspicious_pattern_flags, confidence_signal
  )
  values (
    p_report_id, v_point, p_accuracy_meters, coalesce(p_captured_at_client, now()),
    p_location_source, p_manual_address, v_distance_to_center,
    v_outside_boundary, v_flags, v_confidence
  )
  returning * into v_row;

  perform public.append_audit_event(
    'report',
    p_report_id,
    'report.location_recorded',
    jsonb_build_object(
      'location_source', p_location_source,
      'outside_event_boundary', v_outside_boundary,
      'suspicious_pattern_flags', v_flags
    )
  );

  return v_row;
end;
$$;

comment on function public.record_geolocation_observation(uuid, double precision, double precision, numeric, timestamptz, public.location_source, text) is
  'The only sanctioned insert path for geolocation_observations — validates ownership and coordinate range, computes the advisory geofence-distance/boundary/suspicious-pattern signals, inserts, and appends a report.location_recorded audit event, atomically. SECURITY DEFINER with an internal owns_report() guard (mirrors the reporter-insert-own RLS policy).';

grant execute on function public.record_geolocation_observation(uuid, double precision, double precision, numeric, timestamptz, public.location_source, text) to authenticated;

-- ============================================================================
-- reverse_geocode_cache — optional reverse-geocoder adapter's cache
-- ============================================================================
-- Keyed by a coordinate rounded to ~11m precision (4 decimal degrees) so
-- nearby lookups within the same block/street share a cache entry rather
-- than every slightly-different GPS fix missing the cache. Not tied to any
-- specific provider — apps/web/src/lib/location/reverse-geocode.ts's
-- adapter interface can be backed by any provider that fills this table
-- the same way. Read/write both happen through the service-role client
-- (server-only reverse-geocode calls), so no RLS policy grants any human
-- role direct access — this is pure infrastructure cache, not
-- user-visible data in its own right (the resolved address is surfaced
-- through the report/evidence it's attached to, not this table directly).

create table public.reverse_geocode_cache (
  id uuid primary key default gen_random_uuid(),
  lat_rounded numeric(7, 4) not null,
  lon_rounded numeric(7, 4) not null,
  resolved_address text,
  provider text not null,
  fetched_at timestamptz not null default now(),
  unique (lat_rounded, lon_rounded, provider)
);

alter table public.reverse_geocode_cache enable row level security;
alter table public.reverse_geocode_cache force row level security;
-- No policies defined — force row level security with zero policies means
-- every role (including authenticated) is denied by default; only the
-- service-role client (which bypasses RLS entirely) can read/write this
-- table, matching its "server-only infrastructure cache" purpose.

comment on table public.reverse_geocode_cache is
  'Server-only cache for the optional reverse-geocoder adapter (apps/web/src/lib/location/reverse-geocode.ts) — coordinates rounded to 4 decimal degrees (~11m) so nearby lookups share an entry. No RLS policy grants any human role access; only the service-role client reads/writes this table.';
