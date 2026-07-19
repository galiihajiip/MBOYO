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
