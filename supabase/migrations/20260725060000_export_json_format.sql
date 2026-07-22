-- BLOCK 26 — widen export_jobs.format to include 'json' (CSV/GeoJSON/JSON
-- per this block's requirement, up from CSV/GeoJSON only). The original
-- constraint was an unnamed inline check, auto-named export_jobs_format_check
-- by Postgres — dropped and recreated with the wider set rather than left
-- in place, since a plain check constraint has no ALTER ... ADD VALUE
-- equivalent (unlike a real enum type).

alter table public.export_jobs
  drop constraint export_jobs_format_check,
  add constraint export_jobs_format_check check (format in ('csv', 'geojson', 'json'));

comment on column public.export_jobs.format is
  'csv | geojson | json (BLOCK 26 added json) — the requested export file format.';
