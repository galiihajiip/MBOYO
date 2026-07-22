-- BLOCK 24 — Coordinator Command Center: incident_clusters and
-- response_tasks lifecycle RPCs. incident_clusters/cluster_members/
-- response_tasks/task_assignments tables and their RLS already exist
-- (20260716153709/153711) — this migration only adds the write-path RPCs
-- the Coordinator's Prioritas/Tugas Respons screens call, mirroring
-- submit_verification_decision's exact SECURITY DEFINER shape: internal
-- has_role() guard (never trusting the RLS grant alone, since these are
-- SECURITY DEFINER), current_profile_id() server-side actor resolution,
-- row lock, precondition validation, the write, then append_audit_event.
--
-- Clustering itself is NOT automatic (see cluster_destroyed_reports'
-- existing "read-only suggestion" comment) — create_incident_cluster below
-- is the only way an incident_cluster row is created, always an explicit
-- Coordinator action naming a human label and a starting set of verified
-- reports, per this block's user-approved decision.

-- ============================================================================
-- create_incident_cluster — groups a set of verified reports under one
-- human-labeled incident_cluster. A report already in cluster_members
-- (unique on report_id) cannot be added to a second cluster.
-- ============================================================================

create function public.create_incident_cluster(
  p_disaster_event_id uuid,
  p_label text,
  p_report_ids uuid[]
)
returns public.incident_clusters
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid;
  v_cluster public.incident_clusters;
  v_report_id uuid;
  v_report_count integer;
begin
  if not public.has_role('response_coordinator') then
    raise exception 'create_incident_cluster: caller must hold the response_coordinator role' using errcode = '42501';
  end if;

  v_actor_profile_id := public.current_profile_id();
  if v_actor_profile_id is null then
    raise exception 'create_incident_cluster: no profile for calling user' using errcode = '42501';
  end if;

  if p_label is null or length(trim(p_label)) = 0 then
    raise exception 'create_incident_cluster: label is required' using errcode = '22023';
  end if;

  if p_report_ids is null or array_length(p_report_ids, 1) is null then
    raise exception 'create_incident_cluster: at least one report_id is required' using errcode = '22023';
  end if;

  -- Every named report must exist, be verified, and belong to this event —
  -- a Coordinator can only see verified reports at all (RLS), but this
  -- SECURITY DEFINER function bypasses RLS, so the check is repeated
  -- explicitly here rather than relying on the caller's own visibility.
  select count(*) into v_report_count
  from public.reports r
  where r.id = any(p_report_ids)
    and r.status = 'verified'
    and r.disaster_event_id = p_disaster_event_id;

  if v_report_count <> array_length(p_report_ids, 1) then
    raise exception 'create_incident_cluster: every report_id must be a verified report belonging to the given disaster_event_id'
      using errcode = 'P0001';
  end if;

  if exists (select 1 from public.cluster_members cm where cm.report_id = any(p_report_ids)) then
    raise exception 'create_incident_cluster: one or more reports already belong to a cluster' using errcode = 'P0001';
  end if;

  insert into public.incident_clusters (disaster_event_id, label, created_by_profile_id)
  values (p_disaster_event_id, trim(p_label), v_actor_profile_id)
  returning * into v_cluster;

  foreach v_report_id in array p_report_ids loop
    insert into public.cluster_members (incident_cluster_id, report_id)
    values (v_cluster.id, v_report_id);
  end loop;

  perform public.append_audit_event(
    'incident_cluster',
    v_cluster.id,
    'incident_cluster.created',
    jsonb_build_object('label', v_cluster.label, 'report_ids', to_jsonb(p_report_ids))
  );

  return v_cluster;
end;
$$;

grant execute on function public.create_incident_cluster(uuid, text, uuid[]) to authenticated;

-- ============================================================================
-- add_reports_to_cluster — extends an existing cluster with more verified
-- reports, same one-cluster-per-report invariant.
-- ============================================================================

create function public.add_reports_to_cluster(
  p_incident_cluster_id uuid,
  p_report_ids uuid[]
)
returns public.incident_clusters
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cluster public.incident_clusters;
  v_report_id uuid;
  v_report_count integer;
begin
  if not public.has_role('response_coordinator') then
    raise exception 'add_reports_to_cluster: caller must hold the response_coordinator role' using errcode = '42501';
  end if;

  select * into v_cluster from public.incident_clusters where id = p_incident_cluster_id for update;
  if not found then
    raise exception 'add_reports_to_cluster: cluster % not found', p_incident_cluster_id using errcode = 'P0002';
  end if;

  if p_report_ids is null or array_length(p_report_ids, 1) is null then
    raise exception 'add_reports_to_cluster: at least one report_id is required' using errcode = '22023';
  end if;

  select count(*) into v_report_count
  from public.reports r
  where r.id = any(p_report_ids)
    and r.status = 'verified'
    and r.disaster_event_id = v_cluster.disaster_event_id;

  if v_report_count <> array_length(p_report_ids, 1) then
    raise exception 'add_reports_to_cluster: every report_id must be a verified report belonging to the cluster''s disaster_event_id'
      using errcode = 'P0001';
  end if;

  if exists (select 1 from public.cluster_members cm where cm.report_id = any(p_report_ids)) then
    raise exception 'add_reports_to_cluster: one or more reports already belong to a cluster' using errcode = 'P0001';
  end if;

  foreach v_report_id in array p_report_ids loop
    insert into public.cluster_members (incident_cluster_id, report_id)
    values (p_incident_cluster_id, v_report_id);
  end loop;

  perform public.append_audit_event(
    'incident_cluster',
    v_cluster.id,
    'incident_cluster.reports_added',
    jsonb_build_object('report_ids', to_jsonb(p_report_ids))
  );

  return v_cluster;
end;
$$;

grant execute on function public.add_reports_to_cluster(uuid, uuid[]) to authenticated;

-- ============================================================================
-- create_response_task — draft-status task targeting exactly one report XOR
-- one incident_cluster, per response_tasks_exactly_one_target.
-- ============================================================================

create function public.create_response_task(
  p_report_id uuid,
  p_incident_cluster_id uuid,
  p_category text,
  p_description text,
  p_due_at timestamptz default null,
  p_priority public.priority_level default 'unassigned',
  p_resources text default null
)
returns public.response_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid;
  v_task public.response_tasks;
begin
  if not public.has_role('response_coordinator') then
    raise exception 'create_response_task: caller must hold the response_coordinator role' using errcode = '42501';
  end if;

  v_actor_profile_id := public.current_profile_id();
  if v_actor_profile_id is null then
    raise exception 'create_response_task: no profile for calling user' using errcode = '42501';
  end if;

  if (p_report_id is null) = (p_incident_cluster_id is null) then
    raise exception 'create_response_task: exactly one of report_id or incident_cluster_id is required' using errcode = '22023';
  end if;

  if p_report_id is not null and not exists (
    select 1 from public.reports r where r.id = p_report_id and r.status = 'verified'
  ) then
    raise exception 'create_response_task: report % is not a verified report', p_report_id using errcode = 'P0001';
  end if;

  if p_incident_cluster_id is not null and not exists (
    select 1 from public.incident_clusters c where c.id = p_incident_cluster_id
  ) then
    raise exception 'create_response_task: cluster % not found', p_incident_cluster_id using errcode = 'P0002';
  end if;

  if p_category is null or length(trim(p_category)) = 0 then
    raise exception 'create_response_task: category is required' using errcode = '22023';
  end if;

  if p_priority = 'critical' then
    raise exception 'create_response_task: critical priority cannot be set on creation — create the task, then use set_response_task_priority with a reason'
      using errcode = '22023';
  end if;

  insert into public.response_tasks (
    report_id, incident_cluster_id, status, priority, created_by_profile_id,
    category, description, due_at, resources
  )
  values (
    p_report_id, p_incident_cluster_id, 'draft', p_priority, v_actor_profile_id,
    trim(p_category), p_description, p_due_at, p_resources
  )
  returning * into v_task;

  perform public.append_audit_event(
    'response_task',
    v_task.id,
    'response_task.created',
    jsonb_build_object(
      'report_id', p_report_id,
      'incident_cluster_id', p_incident_cluster_id,
      'category', v_task.category,
      'description', v_task.description,
      'due_at', v_task.due_at,
      'priority', p_priority,
      'resources', v_task.resources
    )
  );

  return v_task;
end;
$$;

grant execute on function public.create_response_task(uuid, uuid, text, text, timestamptz, public.priority_level, text) to authenticated;

-- ============================================================================
-- assign_response_task — inserts a task_assignments row and advances
-- draft -> assigned. Any profile (any role) may be assigned, per this
-- block's user-approved decision.
-- ============================================================================

create function public.assign_response_task(
  p_task_id uuid,
  p_assignee_profile_id uuid
)
returns public.response_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid;
  v_task public.response_tasks;
begin
  if not public.has_role('response_coordinator') then
    raise exception 'assign_response_task: caller must hold the response_coordinator role' using errcode = '42501';
  end if;

  v_actor_profile_id := public.current_profile_id();
  if v_actor_profile_id is null then
    raise exception 'assign_response_task: no profile for calling user' using errcode = '42501';
  end if;

  select * into v_task from public.response_tasks where id = p_task_id for update;
  if not found then
    raise exception 'assign_response_task: task % not found', p_task_id using errcode = 'P0002';
  end if;

  if v_task.status not in ('draft', 'assigned') then
    raise exception 'assign_response_task: task % is in status % — assignment is only valid from draft or assigned (reassignment)', p_task_id, v_task.status
      using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_assignee_profile_id) then
    raise exception 'assign_response_task: assignee profile % not found', p_assignee_profile_id using errcode = 'P0002';
  end if;

  -- Reassignment: close out any still-open assignment before inserting the
  -- new one, so task_assignments_assignee_select_own's "unassigned_at is
  -- null" scoping always reflects exactly the current assignee(s).
  update public.task_assignments
  set unassigned_at = now()
  where response_task_id = p_task_id and unassigned_at is null;

  insert into public.task_assignments (response_task_id, assignee_profile_id, assigned_by_profile_id)
  values (p_task_id, p_assignee_profile_id, v_actor_profile_id);

  update public.response_tasks
  set status = 'assigned'
  where id = p_task_id
  returning * into v_task;

  perform public.append_audit_event(
    'response_task',
    p_task_id,
    'response_task.assigned',
    jsonb_build_object('assignee_profile_id', p_assignee_profile_id)
  );

  return v_task;
end;
$$;

grant execute on function public.assign_response_task(uuid, uuid) to authenticated;

-- ============================================================================
-- transition_response_task_status — the assignee-driven state machine
-- (acknowledged/in_progress/blocked/completed) plus Coordinator-only
-- cancellation from any non-terminal state, per STATE_MACHINES.md's Task
-- State Machine table. Authorization for "is this caller the assignee" is
-- the same exists-join response_tasks_assignee_update_own's RLS policy
-- already expresses — repeated here explicitly since this is SECURITY
-- DEFINER and therefore bypasses that policy.
-- ============================================================================

create function public.transition_response_task_status(
  p_task_id uuid,
  p_new_status public.task_status,
  p_reason text default null
)
returns public.response_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_profile_id uuid;
  v_task public.response_tasks;
  v_previous_status public.task_status;
  v_is_assignee boolean;
  v_is_coordinator boolean;
  v_action text;
begin
  v_actor_profile_id := public.current_profile_id();
  if v_actor_profile_id is null then
    raise exception 'transition_response_task_status: no profile for calling user' using errcode = '42501';
  end if;

  select * into v_task from public.response_tasks where id = p_task_id for update;
  if not found then
    raise exception 'transition_response_task_status: task % not found', p_task_id using errcode = 'P0002';
  end if;

  v_previous_status := v_task.status;
  v_is_coordinator := public.has_role('response_coordinator');
  v_is_assignee := exists (
    select 1 from public.task_assignments ta
    where ta.response_task_id = p_task_id
      and ta.assignee_profile_id = v_actor_profile_id
      and ta.unassigned_at is null
  );

  if p_new_status = 'cancelled' then
    -- Coordinator-exclusive per STATE_MACHINES.md — an assignee cannot
    -- cancel their own task.
    if not v_is_coordinator then
      raise exception 'transition_response_task_status: only a response_coordinator may cancel a task' using errcode = '42501';
    end if;
    if v_task.status in ('completed', 'cancelled') then
      raise exception 'transition_response_task_status: task % is already terminal (%)', p_task_id, v_task.status using errcode = 'P0001';
    end if;
    if p_reason is null or length(trim(p_reason)) = 0 then
      raise exception 'transition_response_task_status: a reason is required to cancel a task' using errcode = '22023';
    end if;
    v_action := 'response_task.cancelled';
  else
    if not v_is_assignee then
      raise exception 'transition_response_task_status: only the current assignee may advance task status' using errcode = '42501';
    end if;

    if (v_task.status, p_new_status) not in (
      ('assigned', 'acknowledged'),
      ('acknowledged', 'in_progress'),
      ('in_progress', 'blocked'),
      ('blocked', 'in_progress'),
      ('in_progress', 'completed')
    ) then
      raise exception 'transition_response_task_status: % -> % is not a valid transition', v_task.status, p_new_status
        using errcode = 'P0001';
    end if;

    v_action := case p_new_status
      when 'acknowledged' then 'response_task.acknowledged'
      when 'in_progress' then (case v_task.status when 'blocked' then 'response_task.unblocked' else 'response_task.started' end)
      when 'blocked' then 'response_task.blocked'
      when 'completed' then 'response_task.completed'
    end;
  end if;

  update public.response_tasks
  set status = p_new_status,
      closed_at = case when p_new_status in ('completed', 'cancelled') then now() else closed_at end
  where id = p_task_id
  returning * into v_task;

  perform public.append_audit_event(
    'response_task',
    p_task_id,
    v_action,
    jsonb_build_object('previous_status', v_previous_status, 'new_status', p_new_status, 'reason', p_reason)
  );

  return v_task;
end;
$$;

grant execute on function public.transition_response_task_status(uuid, public.task_status, text) to authenticated;
