-- BLOCK 21 — worker job-lifecycle functions: reclaiming a crashed worker's
-- stale 'processing' jobs, dead-lettering a job past the retry limit, and
-- atomically recording a completed inference result (prediction +
-- explanation + report transition) in one transaction so a worker restart
-- mid-write can never produce a duplicate model_predictions row or leave
-- the report status inconsistent with the job status.
--
-- Retry/dead-letter limits (documented, provisional — not derived from any
-- real production incident data, since this system has not run in
-- production yet; a future block should revisit these once real failure
-- rates are observed):
--   MAX_ATTEMPTS = 3        (claim_analysis_jobs already increments
--                            analysis_jobs.attempts on every claim, so the
--                            3rd claim is the final allowed attempt)
--   PROCESSING_LEASE = 5 minutes (a job claimed longer ago than this and
--                            still 'processing' is presumed to belong to a
--                            crashed/hung worker and becomes reclaimable)

-- ============================================================================
-- reclaim_stale_analysis_jobs — requeues jobs stuck in 'processing' past the
-- lease window (crashed worker never completed them), or dead-letters them
-- to 'failed' if they have already exhausted MAX_ATTEMPTS. Intended to be
-- called periodically by apps/worker itself (a lightweight self-healing
-- sweep, no separate cron infra required at this stage) before each claim
-- cycle, per docs/adr/0003-database-job-queue.md's "recoverable by re-claim
-- after a lease-expiry check on claimed_at" design note, which previously
-- had no implementing SQL.
-- ============================================================================

create function public.reclaim_stale_analysis_jobs(
  lease_seconds integer default 300,
  max_attempts integer default 3
)
returns table (
  id uuid,
  new_status public.analysis_job_status
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  -- Same caller restriction as claim_analysis_jobs: service-role bypasses
  -- this check entirely (Supabase design), so in practice only
  -- apps/worker's service-role connection or a system_administrator health
  -- tool can invoke this.
  if not public.has_role('system_administrator') then
    raise exception 'reclaim_stale_analysis_jobs: only callable by service-role or system_administrator (health tooling)';
  end if;

  return query
    update public.analysis_jobs j
    set status = case
          when j.attempts >= max_attempts then 'failed'::public.analysis_job_status
          else 'queued'::public.analysis_job_status
        end,
        -- A requeued job clears claimed_by/claimed_at so it looks
        -- unclaimed again for claim_analysis_jobs' next scan; a
        -- dead-lettered job keeps its last claimed_by/claimed_at as a
        -- forensic record of which worker last held it.
        claimed_by = case when j.attempts >= max_attempts then j.claimed_by else null end,
        claimed_at = case when j.attempts >= max_attempts then j.claimed_at else null end,
        error = case
          when j.attempts >= max_attempts then coalesce(j.error, 'dead-lettered: exceeded max_attempts after stale processing lease expired')
          else j.error
        end,
        completed_at = case when j.attempts >= max_attempts then now() else j.completed_at end
    from (
      select stale.id, stale.attempts
      from public.analysis_jobs stale
      where stale.status = 'processing'
        and stale.claimed_at < now() - make_interval(secs => lease_seconds)
      for update skip locked
    ) as target
    where j.id = target.id
    returning j.id, j.status;
end;
$$;

comment on function public.reclaim_stale_analysis_jobs(integer, integer) is
  'Requeues (or dead-letters past max_attempts) analysis_jobs stuck in processing past lease_seconds — recovers jobs orphaned by a crashed worker. SECURITY DEFINER with the same service-role/system_administrator guard as claim_analysis_jobs.';

grant execute on function public.reclaim_stale_analysis_jobs(integer, integer) to authenticated;

-- ============================================================================
-- mark_report_analysis_running — the report-side half of
-- analysis_queued -> analysis_running (docs/product/STATE_MACHINES.md).
-- claim_analysis_jobs itself only touches analysis_jobs (it claims a batch
-- across potentially many different reports in one call); apps/worker calls
-- this once per claimed job immediately after claiming, so the report's
-- own status reflects "a worker is actively processing this" without
-- claim_analysis_jobs needing report-level knowledge baked into its batch
-- semantics.
-- ============================================================================

create function public.mark_report_analysis_running(p_report_id uuid)
returns public.reports
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_report public.reports;
begin
  if not public.has_role('system_administrator') then
    raise exception 'mark_report_analysis_running: only callable by service-role or system_administrator (health tooling)';
  end if;

  update public.reports
  set status = 'analysis_running'
  where id = p_report_id
    and status = 'analysis_queued'
  returning * into v_report;

  return v_report;
end;
$$;

comment on function public.mark_report_analysis_running(uuid) is
  'Advances a report from analysis_queued to analysis_running when apps/worker claims its analysis_job — a no-op (returns no row) if the report is not currently analysis_queued, e.g. on a retried claim.';

grant execute on function public.mark_report_analysis_running(uuid) to authenticated;

-- ============================================================================
-- record_analysis_result — the single atomic write path for a successful
-- inference: inserts model_predictions (and, if given, model_explanations),
-- marks the analysis_job 'done', and advances the report to either
-- 'analysis_completed' or 'needs_manual_review' (when is_advisory_only or
-- quality_score is below the given floor) — all in one transaction, so a
-- worker crash between "wrote the prediction" and "updated the job/report
-- status" can never happen: either the whole result lands, or none of it
-- does. This is also what makes a worker restart safe without special
-- dedup logic in application code — model_predictions.analysis_job_id is
-- UNIQUE, so a retried call for an already-recorded job raises a unique
-- violation instead of silently inserting a second prediction; the worker
-- catches that specific error and treats the job as already complete
-- (see apps/worker's own idempotency handling).
-- ============================================================================

create function public.record_analysis_result(
  p_analysis_job_id uuid,
  p_report_id uuid,
  p_model_registry_entry_id uuid,
  p_severity_probabilities jsonb,
  p_quality_score numeric,
  p_is_advisory_only boolean,
  p_needs_manual_review boolean,
  p_duplicate_candidate_report_id uuid default null,
  p_explanation_type text default null,
  p_explanation_payload jsonb default null
)
returns public.model_predictions
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_prediction public.model_predictions;
  v_next_status public.report_status;
  v_job_report_id uuid;
begin
  if not public.has_role('system_administrator') then
    raise exception 'record_analysis_result: only callable by service-role or system_administrator (health tooling)';
  end if;

  -- p_report_id is accepted as an explicit parameter (rather than looked up
  -- internally) so the caller's intent is self-documenting in the call
  -- site, but it must actually match the job's own report_id — otherwise a
  -- caller bug could silently write a prediction/report-transition for the
  -- wrong report.
  select report_id into v_job_report_id from public.analysis_jobs where id = p_analysis_job_id;
  if v_job_report_id is null then
    raise exception 'record_analysis_result: analysis_job % does not exist', p_analysis_job_id;
  end if;
  if v_job_report_id <> p_report_id then
    raise exception 'record_analysis_result: p_report_id % does not match analysis_job %''s report_id %',
      p_report_id, p_analysis_job_id, v_job_report_id;
  end if;

  insert into public.model_predictions (
    analysis_job_id, report_id, severity_probabilities, quality_score,
    duplicate_candidate_report_id, is_advisory_only
  )
  values (
    p_analysis_job_id, p_report_id, p_severity_probabilities, p_quality_score,
    p_duplicate_candidate_report_id, p_is_advisory_only
  )
  returning * into v_prediction;

  if p_explanation_type is not null then
    insert into public.model_explanations (model_prediction_id, explanation_type, payload)
    values (v_prediction.id, p_explanation_type, coalesce(p_explanation_payload, '{}'::jsonb));
  end if;

  update public.analysis_jobs
  set status = 'done', model_registry_entry_id = p_model_registry_entry_id, completed_at = now()
  where id = p_analysis_job_id;

  v_next_status := case
    when p_needs_manual_review or p_is_advisory_only then 'needs_manual_review'::public.report_status
    else 'analysis_completed'::public.report_status
  end;

  update public.reports
  set status = v_next_status
  where id = p_report_id
    and status = 'analysis_running';

  return v_prediction;
end;
$$;

comment on function public.record_analysis_result(uuid, uuid, uuid, jsonb, numeric, boolean, boolean, uuid, text, jsonb) is
  'Atomically records a model_predictions row (and optional model_explanations row), marks the analysis_job done, and advances the report to analysis_completed or needs_manual_review. The unique constraint on model_predictions.analysis_job_id makes a retried call for an already-completed job fail with a unique violation rather than double-inserting, which is what makes worker restarts safe.';

grant execute on function public.record_analysis_result(uuid, uuid, uuid, jsonb, numeric, boolean, boolean, uuid, text, jsonb) to authenticated;

-- ============================================================================
-- fail_analysis_job — records a transient-failure attempt without
-- dead-lettering (the job goes back to 'queued' for the next claim cycle,
-- unless max_attempts is already exhausted, in which case it is
-- dead-lettered immediately and the report is flagged for manual review) —
-- distinct from reclaim_stale_analysis_jobs, which handles a worker that
-- never reported back at all; this handles a worker that DID report back,
-- with an explicit error.
-- ============================================================================

create function public.fail_analysis_job(
  p_analysis_job_id uuid,
  p_report_id uuid,
  p_error text,
  p_max_attempts integer default 3
)
returns public.analysis_jobs
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_job public.analysis_jobs;
  v_job_report_id uuid;
begin
  if not public.has_role('system_administrator') then
    raise exception 'fail_analysis_job: only callable by service-role or system_administrator (health tooling)';
  end if;

  select report_id into v_job_report_id from public.analysis_jobs where id = p_analysis_job_id;
  if v_job_report_id is null then
    raise exception 'fail_analysis_job: analysis_job % does not exist', p_analysis_job_id;
  end if;
  if v_job_report_id <> p_report_id then
    raise exception 'fail_analysis_job: p_report_id % does not match analysis_job %''s report_id %',
      p_report_id, p_analysis_job_id, v_job_report_id;
  end if;

  update public.analysis_jobs
  set status = case when attempts >= p_max_attempts then 'failed'::public.analysis_job_status else 'queued'::public.analysis_job_status end,
      error = p_error,
      claimed_by = case when attempts >= p_max_attempts then claimed_by else null end,
      claimed_at = case when attempts >= p_max_attempts then claimed_at else null end,
      completed_at = case when attempts >= p_max_attempts then now() else completed_at end
  where id = p_analysis_job_id
  returning * into v_job;

  if v_job.status = 'failed' then
    update public.reports
    set status = 'needs_manual_review'
    where id = p_report_id
      and status = 'analysis_running';
  end if;

  return v_job;
end;
$$;

comment on function public.fail_analysis_job(uuid, uuid, text, integer) is
  'Records a transient inference failure: requeues the job for another attempt, or dead-letters it to failed (and flags the report needs_manual_review) once max_attempts is exhausted.';

grant execute on function public.fail_analysis_job(uuid, uuid, text, integer) to authenticated;
