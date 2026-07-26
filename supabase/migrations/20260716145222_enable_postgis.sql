-- Platform-level extension setup for MBOYO.
--
-- This migration enables only the extensions the platform itself depends on
-- (PostGIS for geospatial types/queries per docs/adr/0002-supabase-platform.md
-- and docs/security/THREAT_MODEL.md threat #3 GPS/geofence handling).
--
-- Domain schema (organization, profile, report, analysis_jobs, etc. per
-- docs/product/DOMAIN_MODEL.md) is deliberately NOT created here — that is
-- scoped to a later block per this block's "do not implement full schema
-- yet" instruction. This migration exists solely so PostGIS is verifiably
-- present in a fresh local database.

create extension if not exists postgis with schema extensions;

-- Cloud projects don't always default the migration role's search_path to
-- include `extensions` the way local Supabase's bootstrap does — without
-- this, every later migration's unqualified `geography`/`geometry` column
-- type reference fails with "type does not exist" (PostGIS types live in
-- extensions, not public). Local dev is unaffected since it already has
-- this on the role.
alter role postgres set search_path = public, extensions;
set search_path = public, extensions;
