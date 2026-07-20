-- RLS tests for public.reports, exercising the RBAC_MATRIX.md rules via
-- actual Postgres role-switching + auth.uid() simulation, not just policy
-- inspection — this is the difference between "the policy exists" and "the
-- policy actually produces the correct visible row set."
--
-- Pattern: `set local role authenticated; select set_config('request.jwt.claims', ...)`
-- simulates a specific auth.uid() the way Supabase's PostgREST layer does in
-- production, so these tests exercise the exact same auth.uid() calls the
-- policies themselves use.

begin;
select plan(9);

-- Look up seeded profile/report ids by their known seed values rather than
-- hardcoding UUIDs, so this test file stays valid if seed.sql regenerates
-- ids (only client_report_id/report content is stable-ish by description).

create temporary table t_ids as
select
  (select user_id from public.profiles where display_name like 'Siti Aminah%') as reporter_user_id,
  (select user_id from public.profiles where display_name like 'Budi Raharjo%') as verifier_user_id,
  (select user_id from public.profiles where display_name like 'Dewi Lestari%') as coordinator_user_id,
  (select user_id from public.profiles where display_name like 'Agus Santoso%') as admin_user_id,
  (select user_id from public.profiles where display_name like 'Rina Wijaya%') as auditor_user_id,
  (select id from public.reports where status = 'verified' limit 1) as verified_report_id,
  (select id from public.reports where status = 'draft_local' limit 1) as draft_report_id;

-- ----------------------------------------------------------------------------
-- Reporter sees only their own reports (all 5 seeded reports belong to the
-- same demo reporter, so this also confirms Reporter sees ALL of their own,
-- not a subset).
-- ----------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select reporter_user_id::text from t_ids))::text, true);

select ok(
  (select count(*) from public.reports) = 5,
  'Reporter sees exactly their own 5 seeded reports'
);

reset role;

-- ----------------------------------------------------------------------------
-- Verifier sees all reports (all statuses), including the draft_local one
-- Coordinator must not see.
-- ----------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select verifier_user_id::text from t_ids))::text, true);

select ok(
  (select count(*) from public.reports) >= 5,
  'Verifier sees all reports regardless of status'
);

select ok(
  (select count(*) from public.reports where id = (select draft_report_id from t_ids)) = 1,
  'Verifier can see a draft_local report'
);

reset role;

-- ----------------------------------------------------------------------------
-- Response Coordinator sees only verified reports — not the draft_local one.
-- ----------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select coordinator_user_id::text from t_ids))::text, true);

select ok(
  (select count(*) from public.reports) = 1,
  'Response Coordinator sees exactly 1 report (only the verified one)'
);

select ok(
  (select count(*) from public.reports where id = (select verified_report_id from t_ids)) = 1,
  'Response Coordinator can see the verified report'
);

select ok(
  (select count(*) from public.reports where id = (select draft_report_id from t_ids)) = 0,
  'Response Coordinator cannot see the draft_local report'
);

reset role;

-- ----------------------------------------------------------------------------
-- System Administrator has NO access to reports (cannot validate) —
-- RBAC_MATRIX.md's explicit "no validate" acceptance criterion, verified as
-- an actual empty result set, not just an assumption.
-- ----------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select admin_user_id::text from t_ids))::text, true);

select ok(
  (select count(*) from public.reports) = 0,
  'System Administrator sees zero reports (no validate-report access, per RBAC_MATRIX.md)'
);

reset role;

-- ----------------------------------------------------------------------------
-- Auditor sees all reports, read-only (a direct UPDATE attempt must fail).
-- ----------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select auditor_user_id::text from t_ids))::text, true);

select ok(
  (select count(*) from public.reports) >= 5,
  'Auditor sees all reports'
);

select throws_ok(
  format(
    $$ update public.reports set description = %L where id = %L $$,
    'tampered', (select verified_report_id from t_ids)
  ),
  null,
  null,
  'Auditor cannot UPDATE a report row (no update policy exists for auditor role)'
);

reset role;

select * from finish();
rollback;
