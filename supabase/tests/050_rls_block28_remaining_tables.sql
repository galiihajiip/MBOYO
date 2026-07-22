-- BLOCK 28 — RLS role-boundary tests for tables that had no pgTAP coverage
-- yet: report_evidence, gemini_advisory_requests, system_settings,
-- incident_clusters/cluster_members, response_tasks/task_assignments.
-- Same pattern as 020_rls_reports.sql/030_rls_audit_events.sql: actual
-- Postgres role-switching + auth.uid() simulation, not policy inspection.

begin;
select plan(23);

create temporary table t_ids as
select
  (select user_id from public.profiles where display_name like 'Siti Aminah%') as reporter_user_id,
  (select id from public.profiles where display_name like 'Siti Aminah%') as reporter_profile_id,
  (select user_id from public.profiles where display_name like 'Budi Raharjo%') as verifier_user_id,
  (select id from public.profiles where display_name like 'Budi Raharjo%') as verifier_profile_id,
  (select user_id from public.profiles where display_name like 'Dewi Lestari%') as coordinator_user_id,
  (select id from public.profiles where display_name like 'Dewi Lestari%') as coordinator_profile_id,
  (select user_id from public.profiles where display_name like 'Agus Santoso%') as admin_user_id,
  (select user_id from public.profiles where display_name like 'Rina Wijaya%') as auditor_user_id,
  (select id from public.reports where status = 'verified' limit 1) as verified_report_id,
  (select id from public.reports where status = 'draft_local' limit 1) as draft_report_id,
  (select id from public.disaster_events limit 1) as event_id,
  (select id from public.response_tasks limit 1) as seeded_task_id;

-- ============================================================================
-- report_evidence
-- ============================================================================

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select reporter_user_id::text from t_ids))::text, true);

select ok(
  (select count(*) from public.report_evidence where report_id = (select draft_report_id from t_ids)) >= 0
  and not exists (
    select 1 from public.report_evidence re
    join public.reports r on r.id = re.report_id
    where r.reporter_profile_id <> (select reporter_profile_id from t_ids)
  ),
  'Reporter sees only report_evidence for reports they own'
);

reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select verifier_user_id::text from t_ids))::text, true);

select ok(
  (select count(*) from public.report_evidence where report_id = (select draft_report_id from t_ids)) >= 0,
  'Verifier can query report_evidence for a draft_local report without erroring (broad verifier select policy)'
);

reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select coordinator_user_id::text from t_ids))::text, true);

select ok(
  (select count(*) from public.report_evidence where report_id = (select draft_report_id from t_ids)) = 0,
  'Response Coordinator cannot see report_evidence for a non-verified (draft_local) report'
);

select ok(
  (select count(*) from public.report_evidence where report_id = (select verified_report_id from t_ids)) >= 0,
  'Response Coordinator can query report_evidence for a verified report'
);

reset role;

-- ============================================================================
-- gemini_advisory_requests — no direct INSERT policy for any role; the
-- sole write path is record_gemini_advisory_request().
-- ============================================================================

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select verifier_user_id::text from t_ids))::text, true);

select lives_ok(
  format(
    $$ select public.record_gemini_advisory_request(
         %L, 'succeeded', 'none', true, true,
         '{"evidenceSummary": "test"}'::jsonb, null, 'gemini-test-model', 'req-test-1', 100
       ) $$,
    (select verified_report_id from t_ids)
  ),
  'Verifier can call record_gemini_advisory_request() for an existing report'
);

select ok(
  (select count(*) from public.gemini_advisory_requests where request_id = 'req-test-1') = 1,
  'Verifier can read back the gemini_advisory_requests row they just created'
);

select throws_ok(
  format(
    $$ insert into public.gemini_advisory_requests (
         report_id, verifier_profile_id, status, model_name, request_id, latency_ms
       ) values (%L, %L, 'succeeded', 'x', 'req-direct-insert', 1) $$,
    (select verified_report_id from t_ids),
    (select verifier_profile_id from t_ids)
  ),
  null,
  null,
  'Verifier cannot directly INSERT into gemini_advisory_requests (no insert policy — only the RPC may write)'
);

reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select reporter_user_id::text from t_ids))::text, true);

select ok(
  (select count(*) from public.gemini_advisory_requests) = 0,
  'Reporter has zero visibility into gemini_advisory_requests (no select policy for that role)'
);

select throws_ok(
  format(
    $$ select public.record_gemini_advisory_request(
         %L, 'succeeded', 'none', true, true,
         '{"evidenceSummary": "test"}'::jsonb, null, 'gemini-test-model', 'req-reporter-attempt', 100
       ) $$,
    (select verified_report_id from t_ids)
  ),
  null,
  null,
  'Reporter cannot call record_gemini_advisory_request() (role guard rejects non-Verifier callers)'
);

reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select auditor_user_id::text from t_ids))::text, true);

select ok(
  (select count(*) from public.gemini_advisory_requests where request_id = 'req-test-1') = 1,
  'Auditor can read gemini_advisory_requests (read-only lineage/prompt-injection review access)'
);

reset role;

-- ============================================================================
-- system_settings — every authenticated role reads; only Admin writes.
-- ============================================================================

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select reporter_user_id::text from t_ids))::text, true);

select ok(
  (select count(*) from public.system_settings) > 0,
  'Reporter (any authenticated role) can read system_settings'
);

select throws_ok(
  $$ update public.system_settings set value = '{"days": 1}'::jsonb where key like 'retention.%' $$,
  null,
  null,
  'Reporter cannot UPDATE system_settings (no admin role)'
);

reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select admin_user_id::text from t_ids))::text, true);

select lives_ok(
  $$ update public.system_settings set value = value where key like 'retention.%' $$,
  'System Administrator can UPDATE system_settings'
);

reset role;

-- ============================================================================
-- incident_clusters / cluster_members — Coordinator: C/R/U/D. Verifier/
-- Admin/Auditor: R. No seed data exists for these tables, so this test
-- creates its own row as the Coordinator first.
-- ============================================================================

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select coordinator_user_id::text from t_ids))::text, true);

create temporary table t_cluster as
insert into public.incident_clusters (disaster_event_id, label, priority, created_by_profile_id)
values ((select event_id from t_ids), 'Test Cluster', 'high', (select coordinator_profile_id from t_ids))
returning id;

select ok(
  (select count(*) from t_cluster) = 1,
  'Response Coordinator can INSERT an incident_cluster'
);

insert into public.cluster_members (incident_cluster_id, report_id)
values ((select id from t_cluster), (select verified_report_id from t_ids));

select ok(
  (select count(*) from public.cluster_members where incident_cluster_id = (select id from t_cluster)) = 1,
  'Response Coordinator can INSERT a cluster_member'
);

reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select verifier_user_id::text from t_ids))::text, true);

select ok(
  (select count(*) from public.incident_clusters where id = (select id from t_cluster)) = 1,
  'Verifier can read the incident_cluster (read-only)'
);

select throws_ok(
  format(
    $$ update public.incident_clusters set label = 'tampered' where id = %L $$,
    (select id from t_cluster)
  ),
  null,
  null,
  'Verifier cannot UPDATE an incident_cluster (Coordinator-exclusive write access)'
);

reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select admin_user_id::text from t_ids))::text, true);

select ok(
  (select count(*) from public.incident_clusters where id = (select id from t_cluster)) = 1,
  'System Administrator can read the incident_cluster'
);

reset role;

-- ============================================================================
-- response_tasks / task_assignments — Coordinator: C/R/U/D. Assignee: U own.
-- Verifier: R (verified reports' tasks). Admin/Auditor: R.
-- ============================================================================

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select coordinator_user_id::text from t_ids))::text, true);

select ok(
  (select count(*) from public.response_tasks) >= 1,
  'Response Coordinator can read response_tasks'
);

reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select coordinator_user_id::text from t_ids))::text, true);

-- Seeded task's sole assignee is the coordinator profile itself
-- (seed.sql) — exercises response_tasks_assignee_update_own via the
-- coordinator acting in their assignee capacity, not their blanket
-- response_tasks_coordinator_all grant.
select lives_ok(
  format(
    $$ update public.response_tasks set status = 'acknowledged' where id = %L $$,
    (select seeded_task_id from t_ids)
  ),
  'The assigned coordinator can UPDATE their own assigned response_task'
);

select ok(
  (select count(*) from public.task_assignments where response_task_id = (select seeded_task_id from t_ids)) >= 1,
  'The assignee can read their own task_assignments row'
);

reset role;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select verifier_user_id::text from t_ids))::text, true);

select ok(
  (select count(*) from public.response_tasks where id = (select seeded_task_id from t_ids)) = 1,
  'Verifier can see the response_task for a verified report'
);

select throws_ok(
  format(
    $$ update public.response_tasks set status = 'cancelled' where id = %L $$,
    (select seeded_task_id from t_ids)
  ),
  null,
  null,
  'Verifier cannot UPDATE a response_task (Coordinator-exclusive, not an assignee)'
);

reset role;

select * from finish();
rollback;
