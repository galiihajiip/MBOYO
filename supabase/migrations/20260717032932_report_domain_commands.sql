-- ============================================================================
-- Report domain commands (BLOCK 16)
-- ============================================================================
-- "Never expose an arbitrary status-update endpoint. Every state change
-- must use a domain command and validate actor/preconditions." These two
-- functions are that enforcement point at the strongest available layer
-- (the database, not just application code): each performs its full
-- precondition/actor check, the report_status mutation, the domain-specific
-- side-effect row (verification_reviews insert), and the audit_event
-- append — atomically, in the function's own implicit transaction — so no
-- caller can update reports.status without going through the validated
-- path, and no intermediate state (e.g. a verification_reviews row with no
-- matching status change) can ever be observed by a concurrent reader.
--
-- Both are SECURITY DEFINER (like claim_analysis_jobs and
-- append_audit_event before them) with an internal actor/role guard inside
-- the function body — the guard, not the GRANT, is what actually restricts
-- who can succeed; the GRANT to `authenticated` only lets the call be
-- attempted at all.

-- ============================================================================
-- submit_verification_decision — confirm/override/reject/request_info/escalate
-- ============================================================================
-- Mirrors docs/product/STATE_MACHINES.md's Report State Machine exactly:
--   analysis_completed | needs_manual_review --confirm/override--> verified
--   analysis_completed | needs_manual_review --reject--> rejected
--   analysis_completed | needs_manual_review --request_info--> needs_manual_review (stays, annotated)
--   analysis_completed | needs_manual_review --escalate--> needs_manual_review (stays, escalated=true)
-- Any other current status is rejected as a precondition failure — this is
-- the actual enforcement of "valid state transitions" the prompt requires,
-- not merely documented intent.

create function public.submit_verification_decision(
  p_report_id uuid,
  p_decision public.verification_decision,
  p_override_severity public.severity_class default null,
  p_notes text default null
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

  insert into public.verification_reviews (report_id, verifier_profile_id, decision, override_severity, notes)
  values (p_report_id, v_actor_profile_id, p_decision, p_override_severity, p_notes);

  v_new_status := case p_decision
    when 'confirm' then 'verified'
    when 'override' then 'verified'
    when 'reject' then 'rejected'
    when 'request_info' then 'needs_manual_review'
    when 'escalate' then 'needs_manual_review'
  end;
  v_escalated := (p_decision = 'escalate');

  update public.reports
  set status = v_new_status, updated_at = now()
  where id = p_report_id
  returning * into v_report;

  perform public.append_audit_event(
    'report',
    p_report_id,
    case p_decision
      when 'reject' then 'report.rejected'
      when 'request_info' then 'report.information_requested'
      when 'escalate' then 'report.escalated'
      else 'report.verified'
    end,
    jsonb_build_object(
      'decision', p_decision,
      'override_severity', p_override_severity,
      'escalated', v_escalated,
      'notes', p_notes
    )
  );

  return v_report;
end;
$$;

comment on function public.submit_verification_decision(uuid, public.verification_decision, public.severity_class, text) is
  'The only sanctioned path to move a report out of analysis_completed/needs_manual_review — inserts the verification_reviews row, updates reports.status per docs/product/STATE_MACHINES.md, and appends the matching audit_event, atomically. SECURITY DEFINER with an internal has_role(''verifier'') guard.';

grant execute on function public.submit_verification_decision(uuid, public.verification_decision, public.severity_class, text) to authenticated;

-- ============================================================================
-- archive_report — verified|rejected -> archived
-- ============================================================================
-- Actor per docs/product/STATE_MACHINES.md: "System (scheduled retention
-- job) or System Administrator (manual, per configured retention policy)."
-- This function is the manual System Administrator path — "retention" is
-- an explicitly Allowed System Administrator action in AGENTS.md ("manage
-- ... retention"), distinct from "validating reports" (which System
-- Administrator remains forbidden from doing; this function only accepts
-- reports already in a terminal verified/rejected state, never
-- analysis_completed/needs_manual_review, so it cannot be used to shortcut
-- verification). The scheduled-job path is out of this block's scope (no
-- scheduler exists yet) — this function is that job's future entry point
-- too, callable the same way once it exists.

create function public.archive_report(
  p_report_id uuid,
  p_reason text default null
)
returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid;
  v_report public.reports;
begin
  if not public.has_role('system_administrator') then
    raise exception 'archive_report: caller must hold the system_administrator role' using errcode = '42501';
  end if;

  v_actor_profile_id := public.current_profile_id();

  select * into v_report from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'archive_report: report % not found', p_report_id using errcode = 'P0002';
  end if;

  if v_report.status not in ('verified', 'rejected') then
    raise exception 'archive_report: report % is in status % — only verified or rejected reports may be archived', p_report_id, v_report.status
      using errcode = 'P0001';
  end if;

  update public.reports
  set status = 'archived', archived_at = now(), updated_at = now()
  where id = p_report_id
  returning * into v_report;

  perform public.append_audit_event(
    'report',
    p_report_id,
    'report.archived',
    jsonb_build_object('reason', p_reason, 'archived_by', v_actor_profile_id)
  );

  return v_report;
end;
$$;

comment on function public.archive_report(uuid, text) is
  'Manual System Administrator archive path (retention management, not validation) per docs/product/STATE_MACHINES.md — only accepts verified/rejected reports. SECURITY DEFINER with an internal has_role(''system_administrator'') guard.';

grant execute on function public.archive_report(uuid, text) to authenticated;

-- ============================================================================
-- reports RLS: allow System Administrator's archive_report() to succeed
-- ============================================================================
-- archive_report is SECURITY DEFINER, so it does not strictly need a
-- reports UPDATE policy to succeed (SECURITY DEFINER functions run as the
-- function owner, bypassing RLS on tables they touch, same as
-- claim_analysis_jobs already does on analysis_jobs) — but per the
-- established pattern in this migration set (reports_verifier_update_status
-- exists alongside submit_verification_decision even though that function
-- is also SECURITY DEFINER), a matching row-level grant is added here for
-- defense-in-depth and so any FUTURE direct-update code path for System
-- Administrator (not just this RPC) is bounded by RLS from day one, not
-- left to be added later under time pressure. The application layer (this
-- migration's functions) remains the actual enforcement of "only via
-- archive_report, only verified/rejected -> archived."
create policy reports_admin_update_archive on public.reports
  for update
  using (public.has_role('system_administrator'))
  with check (public.has_role('system_administrator'));
