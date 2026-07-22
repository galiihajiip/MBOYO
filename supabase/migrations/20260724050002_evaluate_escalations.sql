-- BLOCK 25 — evaluate_escalations(): the single entry point that checks
-- all 6 required rules and raises deduplicated, audited notifications for
-- any that fire. SECURITY DEFINER (it must read across reports/tasks/jobs
-- regardless of caller's own RLS-visible slice, and it writes
-- notifications/audit_events, neither of which any role can INSERT
-- directly) but internally gated to system_administrator OR the service
-- role — the same "who may call a privileged evaluation function" posture
-- as claim_analysis_jobs/reclaim_stale_analysis_jobs (BLOCK 21). Intended
-- callers: a periodic sweep (apps/worker, mirroring its existing
-- claim-loop/reclaim-sweep-loop asyncio pattern — see that migration's own
-- comment) for the two time-based rules (verifier SLA, task overdue), and
-- an event-triggered call (from the domain-service layer, immediately
-- after a relevant write: report verification, task creation, analysis
-- job failure) for the four event-based rules — both call sites converge
-- on this one function so the rule logic and dedup/audit behavior never
-- drift between "checked periodically" and "checked on write."
--
-- Every rule reads its own threshold from the escalation.* system_settings
-- row at evaluation time (never a hardcoded constant) — this is what
-- satisfies "settings change behavior without restart": an Admin's
-- UPDATE to a system_settings row is visible to the very next call of
-- this function with no process restart, since nothing is cached.

create function public.evaluate_escalations(p_organization_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notifications_raised integer := 0;
  v_setting jsonb;
  v_report record;
  v_task record;
  v_job record;
  v_count integer;
  v_inserted_count integer;
begin
  if not (public.has_role('system_administrator') or auth.role() = 'service_role') then
    raise exception 'evaluate_escalations: caller must be system_administrator or service_role' using errcode = '42501';
  end if;

  -- ==========================================================================
  -- Rule 1: verified destroyed above threshold — a single report whose
  -- latest model_predictions row's "destroyed" probability crosses
  -- minProbability, on becoming verified.
  -- ==========================================================================
  select value into v_setting
  from public.system_settings
  where organization_id = p_organization_id and key = 'escalation.verified_destroyed_threshold';

  if v_setting is not null and (v_setting->>'enabled')::boolean then
    for v_report in
      select r.id as report_id, mp.severity_probabilities
      from public.reports r
      join lateral (
        select mp.severity_probabilities
        from public.model_predictions mp
        where mp.report_id = r.id
        order by mp.created_at desc
        limit 1
      ) as mp on true
      where r.disaster_event_id in (select id from public.disaster_events where organization_id = p_organization_id)
        and r.status = 'verified'
        and (mp.severity_probabilities->>'destroyed')::numeric >= (v_setting->>'minProbability')::numeric
    loop
      insert into public.notifications (recipient_profile_id, type, level, payload, dedup_key)
      select p.id, 'verified_destroyed_threshold', v_setting->>'level',
        jsonb_build_object('reportId', v_report.report_id, 'destroyedProbability', (v_report.severity_probabilities->>'destroyed')::numeric),
        'verified_destroyed_threshold:' || v_report.report_id
      from public.profiles p
      join public.role_assignments ra on ra.profile_id = p.id and ra.revoked_at is null
      where p.organization_id = p_organization_id
        and ra.role in ('response_coordinator', 'system_administrator')
      on conflict (dedup_key) where dedup_key is not null do nothing;

      get diagnostics v_inserted_count = row_count;
      if v_inserted_count > 0 then
        v_notifications_raised := v_notifications_raised + 1;
        perform public.append_audit_event('report', v_report.report_id, 'escalation.verified_destroyed_threshold',
          jsonb_build_object('destroyedProbability', (v_report.severity_probabilities->>'destroyed')::numeric));
      end if;
    end loop;
  end if;

  -- ==========================================================================
  -- Rule 2: N destroyed within radius/time window — proximity clustering
  -- over verified destroyed-severity reports, reusing the exact ST_DWithin
  -- technique cluster_destroyed_reports() already established (BLOCK 24
  -- research confirmed no other clustering primitive exists), scoped
  -- additionally to a time window (submitted_at >= now() - windowHours).
  -- One notification per seed report that has minCount-1 or more nearby
  -- companions, deduplicated per seed so re-evaluation is idempotent.
  -- ==========================================================================
  select value into v_setting
  from public.system_settings
  where organization_id = p_organization_id and key = 'escalation.cluster_destroyed_radius';

  if v_setting is not null and (v_setting->>'enabled')::boolean then
    for v_report in
      with destroyed as (
        select r.id as report_id, go.location, r.submitted_at
        from public.reports r
        join public.geolocation_observations go on go.report_id = r.id
        join lateral (
          select mp.severity_probabilities
          from public.model_predictions mp
          where mp.report_id = r.id
          order by mp.created_at desc
          limit 1
        ) as mp on true
        where r.disaster_event_id in (select id from public.disaster_events where organization_id = p_organization_id)
          and r.status = 'verified'
          and (mp.severity_probabilities->>'destroyed')::numeric >= 0.5
          and r.submitted_at >= now() - make_interval(hours => (v_setting->>'windowHours')::integer)
      )
      select
        d1.report_id,
        count(d2.report_id) as nearby_count
      from destroyed d1
      join destroyed d2 on d2.report_id <> d1.report_id
        and st_dwithin(d1.location, d2.location, (v_setting->>'radiusMeters')::double precision)
      group by d1.report_id
      having count(d2.report_id) >= (v_setting->>'minCount')::integer - 1
    loop
      insert into public.notifications (recipient_profile_id, type, level, payload, dedup_key)
      select p.id, 'cluster_destroyed_radius', v_setting->>'level',
        jsonb_build_object('seedReportId', v_report.report_id, 'nearbyCount', v_report.nearby_count),
        'cluster_destroyed_radius:' || v_report.report_id
      from public.profiles p
      join public.role_assignments ra on ra.profile_id = p.id and ra.revoked_at is null
      where p.organization_id = p_organization_id
        and ra.role in ('response_coordinator', 'system_administrator')
      on conflict (dedup_key) where dedup_key is not null do nothing;

      get diagnostics v_inserted_count = row_count;
      if v_inserted_count > 0 then
        v_notifications_raised := v_notifications_raised + 1;
        perform public.append_audit_event('report', v_report.report_id, 'escalation.cluster_destroyed_radius',
          jsonb_build_object('nearbyCount', v_report.nearby_count));
      end if;
    end loop;
  end if;

  -- ==========================================================================
  -- Rule 3: verifier SLA breach — a report still awaiting a decision
  -- (analysis_completed/needs_manual_review) whose submitted_at is older
  -- than hoursSinceSubmission. Reuses the exact predicate BLOCK 23's
  -- SLA_WARNING_HOURS=24 constant already established, now settings-driven
  -- instead of a hardcoded TypeScript constant.
  -- ==========================================================================
  select value into v_setting
  from public.system_settings
  where organization_id = p_organization_id and key = 'escalation.verifier_sla_breach';

  if v_setting is not null and (v_setting->>'enabled')::boolean then
    for v_report in
      select r.id as report_id, r.submitted_at
      from public.reports r
      where r.disaster_event_id in (select id from public.disaster_events where organization_id = p_organization_id)
        and r.status in ('analysis_completed', 'needs_manual_review')
        and r.submitted_at is not null
        and r.submitted_at < now() - make_interval(hours => (v_setting->>'hoursSinceSubmission')::integer)
    loop
      insert into public.notifications (recipient_profile_id, type, level, payload, dedup_key)
      select p.id, 'verifier_sla_breach', v_setting->>'level',
        jsonb_build_object('reportId', v_report.report_id, 'submittedAt', v_report.submitted_at),
        'verifier_sla_breach:' || v_report.report_id
      from public.profiles p
      join public.role_assignments ra on ra.profile_id = p.id and ra.revoked_at is null
      where p.organization_id = p_organization_id
        and ra.role in ('verifier', 'system_administrator')
      on conflict (dedup_key) where dedup_key is not null do nothing;

      get diagnostics v_inserted_count = row_count;
      if v_inserted_count > 0 then
        v_notifications_raised := v_notifications_raised + 1;
        perform public.append_audit_event('report', v_report.report_id, 'escalation.verifier_sla_breach',
          jsonb_build_object('submittedAt', v_report.submitted_at));
      end if;
    end loop;
  end if;

  -- ==========================================================================
  -- Rule 4: response task overdue — reuses the exact predicate
  -- command_dashboard_metrics' overdue_task_count already established
  -- (BLOCK 24): due_at < now() and status not in (completed, cancelled).
  -- ==========================================================================
  select value into v_setting
  from public.system_settings
  where organization_id = p_organization_id and key = 'escalation.task_overdue';

  if v_setting is not null and (v_setting->>'enabled')::boolean then
    for v_task in
      select rt.id as task_id, rt.due_at
      from public.response_tasks rt
      left join public.reports r on r.id = rt.report_id
      left join public.incident_clusters c on c.id = rt.incident_cluster_id
      where coalesce(r.disaster_event_id, c.disaster_event_id) in (
        select id from public.disaster_events where organization_id = p_organization_id
      )
        and rt.due_at is not null
        and rt.due_at < now()
        and rt.status not in ('completed', 'cancelled')
    loop
      insert into public.notifications (recipient_profile_id, type, level, payload, dedup_key)
      select p.id, 'task_overdue', v_setting->>'level',
        jsonb_build_object('taskId', v_task.task_id, 'dueAt', v_task.due_at),
        'task_overdue:' || v_task.task_id
      from public.profiles p
      join public.role_assignments ra on ra.profile_id = p.id and ra.revoked_at is null
      where p.organization_id = p_organization_id
        and ra.role in ('response_coordinator', 'system_administrator')
      on conflict (dedup_key) where dedup_key is not null do nothing;

      get diagnostics v_inserted_count = row_count;
      if v_inserted_count > 0 then
        v_notifications_raised := v_notifications_raised + 1;
        perform public.append_audit_event('response_task', v_task.task_id, 'escalation.task_overdue',
          jsonb_build_object('dueAt', v_task.due_at));
      end if;
    end loop;
  end if;

  -- ==========================================================================
  -- Rule 5: repeated duplicate/spam source — a single reporter_profile_id
  -- with >= minCount reports flagged as duplicate-hash or duplicate
  -- prediction candidates within windowHours. Deduplicated per
  -- reporter+day so a still-repeating source doesn't re-fire every
  -- evaluation, only once per new calendar day it keeps happening.
  -- ==========================================================================
  select value into v_setting
  from public.system_settings
  where organization_id = p_organization_id and key = 'escalation.repeated_duplicate_source';

  if v_setting is not null and (v_setting->>'enabled')::boolean then
    for v_report in
      select r.reporter_profile_id, count(*) as duplicate_count
      from public.reports r
      where r.disaster_event_id in (select id from public.disaster_events where organization_id = p_organization_id)
        and r.created_at >= now() - make_interval(hours => (v_setting->>'windowHours')::integer)
        and (
          exists (select 1 from public.report_evidence re where re.report_id = r.id and re.is_duplicate_hash)
          or exists (
            select 1 from public.model_predictions mp
            where mp.report_id = r.id and mp.duplicate_candidate_report_id is not null
          )
        )
      group by r.reporter_profile_id
      having count(*) >= (v_setting->>'minCount')::integer
    loop
      insert into public.notifications (recipient_profile_id, type, level, payload, dedup_key)
      select p.id, 'repeated_duplicate_source', v_setting->>'level',
        jsonb_build_object('reporterProfileId', v_report.reporter_profile_id, 'duplicateCount', v_report.duplicate_count),
        'repeated_duplicate_source:' || v_report.reporter_profile_id || ':' || to_char(now(), 'YYYY-MM-DD')
      from public.profiles p
      join public.role_assignments ra on ra.profile_id = p.id and ra.revoked_at is null
      where p.organization_id = p_organization_id
        and ra.role in ('verifier', 'system_administrator')
      on conflict (dedup_key) where dedup_key is not null do nothing;

      get diagnostics v_inserted_count = row_count;
      if v_inserted_count > 0 then
        v_notifications_raised := v_notifications_raised + 1;
        perform public.append_audit_event('profile', v_report.reporter_profile_id, 'escalation.repeated_duplicate_source',
          jsonb_build_object('duplicateCount', v_report.duplicate_count));
      end if;
    end loop;
  end if;

  -- ==========================================================================
  -- Rule 6: repeated analysis failure — an analysis_jobs row that has been
  -- dead-lettered (status='failed', attempts at/above the worker's own
  -- max_attempts) at least minFailures times for the same report within
  -- windowHours (a report whose evidence keeps failing analysis, not a
  -- single transient retry).
  -- ==========================================================================
  select value into v_setting
  from public.system_settings
  where organization_id = p_organization_id and key = 'escalation.repeated_analysis_failure';

  if v_setting is not null and (v_setting->>'enabled')::boolean then
    for v_job in
      select aj.report_id, count(*) as failure_count
      from public.analysis_jobs aj
      join public.reports r on r.id = aj.report_id
      where r.disaster_event_id in (select id from public.disaster_events where organization_id = p_organization_id)
        and aj.status = 'failed'
        and aj.created_at >= now() - make_interval(hours => (v_setting->>'windowHours')::integer)
      group by aj.report_id
      having count(*) >= (v_setting->>'minFailures')::integer
    loop
      insert into public.notifications (recipient_profile_id, type, level, payload, dedup_key)
      select p.id, 'repeated_analysis_failure', v_setting->>'level',
        jsonb_build_object('reportId', v_job.report_id, 'failureCount', v_job.failure_count),
        'repeated_analysis_failure:' || v_job.report_id
      from public.profiles p
      join public.role_assignments ra on ra.profile_id = p.id and ra.revoked_at is null
      where p.organization_id = p_organization_id
        and ra.role in ('system_administrator')
      on conflict (dedup_key) where dedup_key is not null do nothing;

      get diagnostics v_inserted_count = row_count;
      if v_inserted_count > 0 then
        v_notifications_raised := v_notifications_raised + 1;
        perform public.append_audit_event('report', v_job.report_id, 'escalation.repeated_analysis_failure',
          jsonb_build_object('failureCount', v_job.failure_count));
      end if;
    end loop;
  end if;

  return v_notifications_raised;
end;
$$;

grant execute on function public.evaluate_escalations(uuid) to authenticated;

comment on function public.evaluate_escalations(uuid) is
  'Evaluates all 6 configurable escalation rules for one organization, raising a deduplicated/audited notification per newly-firing subject. Returns the count of distinct subjects that produced a NEW notification this call (0 on a re-run with nothing new — the idempotence this block requires). Callable by system_administrator or the service role only.';
