-- BLOCK 23 — replaces submit_verification_decision() (BLOCK 16) to add:
--   - insufficient_evidence handling (-> needs_manual_review, like
--     request_info/escalate, but its own distinct audit action),
--   - reject_reason_category (required iff decision=reject),
--   - reports.escalated maintenance (set true on escalate, cleared on any
--     other decision that resolves the report),
--   - supersedes_review_id: when a report already has at least one prior
--     verification_review, the new row records which one it supersedes
--     (its own most recent review) — never inferred by the caller, always
--     computed server-side from the actual prior row, so it can never be
--     spoofed or point at an unrelated report's review.
--
-- The new signature adds a 5th parameter (p_reject_reason_category), which
-- Postgres treats as a distinct function overload rather than a
-- replacement of the original 4-parameter version — the old signature is
-- dropped explicitly first so exactly one submit_verification_decision
-- exists afterward (leaving both would let a stale caller silently keep
-- using the old 4-arg version, bypassing reject_reason_category
-- entirely).

drop function if exists public.submit_verification_decision(uuid, public.verification_decision, public.severity_class, text);

create function public.submit_verification_decision(
  p_report_id uuid,
  p_decision public.verification_decision,
  p_override_severity public.severity_class default null,
  p_notes text default null,
  p_reject_reason_category public.verification_reject_reason default null
)
returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid;
  v_report public.reports;
  v_new_status public.report_status;
  v_escalated boolean := false;
  v_previous_review_id uuid;
  v_new_review_id uuid;
begin
  if not public.has_role('verifier') then
    raise exception 'submit_verification_decision: caller must hold the verifier role' using errcode = '42501';
  end if;

  v_actor_profile_id := public.current_profile_id();
  if v_actor_profile_id is null then
    raise exception 'submit_verification_decision: no profile for calling user' using errcode = '42501';
  end if;

  select * into v_report from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'submit_verification_decision: report % not found' , p_report_id using errcode = 'P0002';
  end if;

  if v_report.status not in ('analysis_completed', 'needs_manual_review') then
    raise exception 'submit_verification_decision: report % is in status % — verification decisions are only valid from analysis_completed or needs_manual_review', p_report_id, v_report.status
      using errcode = 'P0001';
  end if;

  if p_decision = 'override' and p_override_severity is null then
    raise exception 'submit_verification_decision: override_severity is required for an override decision' using errcode = '22023';
  end if;
  if p_decision <> 'override' and p_override_severity is not null then
    raise exception 'submit_verification_decision: override_severity must be null unless decision is override' using errcode = '22023';
  end if;

  if p_decision = 'reject' and p_reject_reason_category is null then
    raise exception 'submit_verification_decision: reject_reason_category is required for a reject decision' using errcode = '22023';
  end if;
  if p_decision <> 'reject' and p_reject_reason_category is not null then
    raise exception 'submit_verification_decision: reject_reason_category must be null unless decision is reject' using errcode = '22023';
  end if;

  -- The most recent prior review for this report (if any) is what the new
  -- row supersedes — computed here, server-side, from the actual data,
  -- never accepted as a caller-supplied id.
  select id into v_previous_review_id
  from public.verification_reviews
  where report_id = p_report_id
  order by decided_at desc
  limit 1;

  insert into public.verification_reviews (
    report_id, verifier_profile_id, decision, override_severity, notes,
    reject_reason_category, supersedes_review_id
  )
  values (
    p_report_id, v_actor_profile_id, p_decision, p_override_severity, p_notes,
    p_reject_reason_category, v_previous_review_id
  )
  returning id into v_new_review_id;

  v_new_status := case p_decision
    when 'confirm' then 'verified'
    when 'override' then 'verified'
    when 'reject' then 'rejected'
    when 'request_info' then 'needs_manual_review'
    when 'escalate' then 'needs_manual_review'
    when 'insufficient_evidence' then 'needs_manual_review'
  end;
  v_escalated := (p_decision = 'escalate');

  update public.reports
  set status = v_new_status, escalated = v_escalated, updated_at = now()
  where id = p_report_id
  returning * into v_report;

  perform public.append_audit_event(
    'report',
    p_report_id,
    case p_decision
      when 'reject' then 'report.rejected'
      when 'request_info' then 'report.information_requested'
      when 'escalate' then 'report.escalated'
      when 'insufficient_evidence' then 'report.insufficient_evidence'
      else 'report.verified'
    end,
    jsonb_build_object(
      'decision', p_decision,
      'override_severity', p_override_severity,
      'reject_reason_category', p_reject_reason_category,
      'escalated', v_escalated,
      'notes', p_notes,
      'verification_review_id', v_new_review_id,
      'supersedes_review_id', v_previous_review_id
    )
  );

  return v_report;
end;
$$;

comment on function public.submit_verification_decision(uuid, public.verification_decision, public.severity_class, text, public.verification_reject_reason) is
  'The only sanctioned path to move a report out of analysis_completed/needs_manual_review — inserts the verification_reviews row (recording which prior review it supersedes, if any), updates reports.status/escalated per docs/product/STATE_MACHINES.md, and appends the matching audit_event, atomically. SECURITY DEFINER with an internal has_role(''verifier'') guard.';

grant execute on function public.submit_verification_decision(uuid, public.verification_decision, public.severity_class, text, public.verification_reject_reason) to authenticated;
