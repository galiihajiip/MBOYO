-- BLOCK 28 — model latency metric. apps/ml-api's /predict response already
-- computes latency_ms (app/inference.py's run_prediction, via
-- time.perf_counter()) but nothing persists it anywhere — it was
-- response-payload data only, never captured as a metric an Admin can see
-- on the health dashboard. This column gives apps/worker somewhere to
-- write that value when it records a prediction, closing that gap.
--
-- Nullable: a model_predictions row created any other way (a future
-- backfill/demo-seed script) simply has no captured latency to report.

alter table public.model_predictions
  add column model_latency_ms numeric(10, 2);

comment on column public.model_predictions.model_latency_ms is
  'BLOCK 28 — the apps/ml-api /predict call''s latency_ms for this prediction, as reported by apps/worker at record time. Null for predictions recorded without a captured latency (e.g. future backfill tooling).';

-- record_analysis_result (20260719061204_worker_job_lifecycle.sql) gains an
-- optional p_model_latency_ms parameter (appended last, default null, so
-- every existing call site/grant continues to work unchanged for anyone
-- who doesn't pass it).

create or replace function public.record_analysis_result(
  p_analysis_job_id uuid,
  p_report_id uuid,
  p_model_registry_entry_id uuid,
  p_severity_probabilities jsonb,
  p_quality_score numeric,
  p_is_advisory_only boolean,
  p_needs_manual_review boolean,
  p_duplicate_candidate_report_id uuid default null,
  p_explanation_type text default null,
  p_explanation_payload jsonb default null,
  p_model_latency_ms numeric default null
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
    duplicate_candidate_report_id, is_advisory_only, model_latency_ms
  )
  values (
    p_analysis_job_id, p_report_id, p_severity_probabilities, p_quality_score,
    p_duplicate_candidate_report_id, p_is_advisory_only, p_model_latency_ms
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

comment on function public.record_analysis_result(uuid, uuid, uuid, jsonb, numeric, boolean, boolean, uuid, text, jsonb, numeric) is
  'Atomically records a model_predictions row (and optional model_explanations row), marks the analysis_job done, and advances the report to analysis_completed or needs_manual_review. BLOCK 28 adds p_model_latency_ms (optional, trailing) so apps/worker can persist apps/ml-api''s reported inference latency for the admin health dashboard.';

grant execute on function public.record_analysis_result(uuid, uuid, uuid, jsonb, numeric, boolean, boolean, uuid, text, jsonb, numeric) to authenticated;
