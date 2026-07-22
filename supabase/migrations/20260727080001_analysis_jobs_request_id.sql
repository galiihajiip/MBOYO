-- BLOCK 28 — end-to-end correlation ID. apps/ml-api's request_context.py
-- and apps/worker's ml_api_client.py already thread an x-request-id across
-- the worker->ml-api leg (worker/processing.py mints one uuid4 per job
-- today), but nothing carries the ORIGINATING request-id from the
-- apps/web API call that first enqueued the analysis_jobs row through to
-- the worker that later claims it — so a single report's full
-- web->worker->ml-api trace can't be reconstructed from logs alone. This
-- column closes that gap: the web route that inserts an analysis_jobs row
-- (apps/web/src/app/api/reports/evidence/route.ts) now writes its own
-- resolveRequestId() value here, and the worker's claim loop reads it back
-- and forwards it to apps/ml-api instead of minting a fresh one per job.
--
-- Nullable: a job created any other way (a future admin retry action, a
-- demo-data seed script) simply has no originating web request to
-- correlate against — the worker falls back to minting its own uuid4 in
-- that case, exactly as it does today.

alter table public.analysis_jobs
  add column request_id text;

comment on column public.analysis_jobs.request_id is
  'BLOCK 28 — the x-request-id of the apps/web API request that created this job, if any. Threaded by apps/worker into every apps/ml-api call for this job, so one report''s full web->worker->ml-api trace can be reconstructed from structured logs by filtering on this one ID. Null for jobs not created via a web API request (e.g. future admin/demo tooling).';

-- claim_analysis_jobs (20260716153713_rpc_functions.sql) returns
-- `setof public.analysis_jobs` (i.e. selects every column) — this new
-- column is therefore already returned to callers without needing to
-- redefine that function.
