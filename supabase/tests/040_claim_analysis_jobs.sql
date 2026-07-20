-- Tests for public.claim_analysis_jobs() concurrency-safety semantics
-- (docs/adr/0003-database-job-queue.md) and the Reporter
-- cannot-insert-for-another-reporter boundary.

begin;
select plan(5);

create temporary table t_claim_ids as
select
  (select user_id from public.profiles where display_name like 'Siti Aminah%') as reporter_user_id,
  (select id from public.profiles where display_name like 'Siti Aminah%') as reporter_profile_id,
  (select id from public.profiles where display_name like 'Budi Raharjo%') as verifier_profile_id,
  (select id from public.disaster_events limit 1) as event_id;

-- ----------------------------------------------------------------------------
-- Seed two fresh queued jobs to claim, independent of whatever seed.sql left
-- in 'done' status.
-- ----------------------------------------------------------------------------

create temporary table t_new_reports as
insert into public.reports (client_report_id, reporter_profile_id, disaster_event_id, status)
select gen_random_uuid(), (select reporter_profile_id from t_claim_ids), (select event_id from t_claim_ids), 'analysis_queued'
from generate_series(1, 2)
returning id;

insert into public.analysis_jobs (report_id, status)
select id, 'queued' from t_new_reports;

-- ----------------------------------------------------------------------------
-- A single claim call with batch_size=1 claims exactly one job, and marks it
-- 'processing' with attempts incremented.
-- ----------------------------------------------------------------------------

select ok(
  (select count(*) from public.claim_analysis_jobs('test-worker-a', 1)) = 1,
  'claim_analysis_jobs(batch_size=1) claims exactly one job'
);

select ok(
  (select count(*) from public.analysis_jobs where status = 'processing' and claimed_by = 'test-worker-a') = 1,
  'the claimed job is marked processing with the correct claimed_by'
);

-- ----------------------------------------------------------------------------
-- A second claim call does not re-claim the job the first call already
-- took (SKIP LOCKED / status='processing' means it's no longer 'queued').
-- ----------------------------------------------------------------------------

select ok(
  (select count(*) from public.claim_analysis_jobs('test-worker-b', 5)) = 1,
  'a second claim call only picks up the one remaining queued job, not the already-claimed one'
);

select ok(
  not exists (
    select 1 from public.analysis_jobs
    where claimed_by = 'test-worker-a' and status <> 'processing'
  ),
  'the first worker''s claimed job was not disturbed by the second claim call'
);

-- ----------------------------------------------------------------------------
-- Reporter cannot insert a report attributed to a different reporter's
-- profile_id — the with-check ownership clause must reject this.
-- ----------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select reporter_user_id::text from t_claim_ids))::text, true);

select throws_ok(
  format(
    $$ insert into public.reports (client_report_id, reporter_profile_id, disaster_event_id, status)
       values (gen_random_uuid(), %L, %L, 'draft_local') $$,
    (select verifier_profile_id from t_claim_ids),
    (select event_id from t_claim_ids)
  ),
  null,
  null,
  'Reporter cannot insert a report attributed to a different profile_id (ownership with-check rejects it)'
);

reset role;

select * from finish();
rollback;
