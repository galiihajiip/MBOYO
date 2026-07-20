-- Geospatial tests: PostGIS presence, GIST index usage, and the
-- reports_in_bbox / reports_within_radius RPC functions.
--
-- Run with: supabase test db (after `supabase db reset` has applied
-- migrations + seed.sql).

begin;
select plan(8);

-- ----------------------------------------------------------------------------
-- PostGIS exists (BLOCK 07 acceptance criterion, re-verified at the schema
-- layer so a schema change can never silently drop the extension without a
-- test failure).
-- ----------------------------------------------------------------------------

select ok(
  exists (select 1 from pg_extension where extname = 'postgis'),
  'postgis extension is installed'
);

select isnt(
  (select extversion from pg_extension where extname = 'postgis'),
  null,
  'postgis has a resolvable version'
);

-- ----------------------------------------------------------------------------
-- geolocation_observations.location is a proper geography(Point,4326) column
-- with a GIST index.
-- ----------------------------------------------------------------------------

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'geolocation_observations'
      and column_name = 'location'
      and udt_name = 'geography'
  ),
  'geolocation_observations.location is a geography column'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'geolocation_observations'
      and indexname = 'geolocation_observations_location_gist_idx'
      and indexdef ilike '%gist%'
  ),
  'geolocation_observations_location_gist_idx is a GIST index'
);

-- ----------------------------------------------------------------------------
-- reports_in_bbox: a point clearly inside a generous bbox around Jakarta
-- must be found; a point far outside must not.
-- ----------------------------------------------------------------------------

select ok(
  (
    select count(*) > 0
    from public.reports_in_bbox(106.0, -7.0, 108.0, -5.0)
  ),
  'reports_in_bbox finds at least one seeded report within a generous Jakarta-area bbox'
);

select ok(
  (
    select count(*) = 0
    from public.reports_in_bbox(0.0, 0.0, 1.0, 1.0)
  ),
  'reports_in_bbox finds no reports in a bbox far from any seeded location (Gulf of Guinea)'
);

-- ----------------------------------------------------------------------------
-- reports_within_radius: the verified demo report's own coordinate must be
-- within a 1km radius of itself; a radius of 1 meter around a distant point
-- must return nothing.
-- ----------------------------------------------------------------------------

select ok(
  (
    select count(*) > 0
    from public.reports_within_radius(106.822, -6.261, 1000)
  ),
  'reports_within_radius finds the seeded verified report within 1000m of its own coordinate'
);

select ok(
  (
    select count(*) = 0
    from public.reports_within_radius(0.0, 0.0, 1)
  ),
  'reports_within_radius finds nothing within 1m of a point far from any seeded location'
);

select * from finish();
rollback;
