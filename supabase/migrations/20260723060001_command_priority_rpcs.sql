-- BLOCK 24 — priority-change RPCs for response_tasks and incident_clusters.
-- Both tables already have a `priority public.priority_level` column
-- (20260716153709) but nothing writes to it yet. Per STATE_MACHINES.md's
-- "Priority Levels" section (and this block's user-approved decision to
-- cover both entities with the same pattern): priority is Coordinator-only,
-- settable at any time before a task reaches completed/cancelled, never
-- derived from model_prediction severity, and a change to/through
-- 'critical' requires a non-empty reason — always audited as
-- '<entity>.priority_changed' with old_priority/new_priority/reason.

create function public.set_response_task_priority(
  p_task_id uuid,
  p_priority public.priority_level,
  p_reason text default null
)
returns public.response_tasks
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_task public.response_tasks;
  v_previous_priority public.priority_level;
begin
  if not public.has_role('response_coordinator') then
    raise exception 'set_response_task_priority: caller must hold the response_coordinator role' using errcode = '42501';
  end if;

  select * into v_task from public.response_tasks where id = p_task_id for update;
  if not found then
    raise exception 'set_response_task_priority: task % not found', p_task_id using errcode = 'P0002';
  end if;

  if v_task.status in ('completed', 'cancelled') then
    raise exception 'set_response_task_priority: task % is already terminal (%) — priority can no longer be changed', p_task_id, v_task.status
      using errcode = 'P0001';
  end if;

  if p_priority = 'critical' and (p_reason is null or length(trim(p_reason)) = 0) then
    raise exception 'set_response_task_priority: a reason is required to set critical priority' using errcode = '22023';
  end if;

  v_previous_priority := v_task.priority;

  update public.response_tasks
  set priority = p_priority
  where id = p_task_id
  returning * into v_task;

  perform public.append_audit_event(
    'response_task',
    p_task_id,
    'response_task.priority_changed',
    jsonb_build_object('old_priority', v_previous_priority, 'new_priority', p_priority, 'reason', p_reason)
  );

  return v_task;
end;
$$;

grant execute on function public.set_response_task_priority(uuid, public.priority_level, text) to authenticated;

create function public.set_incident_cluster_priority(
  p_cluster_id uuid,
  p_priority public.priority_level,
  p_reason text default null
)
returns public.incident_clusters
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_cluster public.incident_clusters;
  v_previous_priority public.priority_level;
begin
  if not public.has_role('response_coordinator') then
    raise exception 'set_incident_cluster_priority: caller must hold the response_coordinator role' using errcode = '42501';
  end if;

  select * into v_cluster from public.incident_clusters where id = p_cluster_id for update;
  if not found then
    raise exception 'set_incident_cluster_priority: cluster % not found', p_cluster_id using errcode = 'P0002';
  end if;

  if p_priority = 'critical' and (p_reason is null or length(trim(p_reason)) = 0) then
    raise exception 'set_incident_cluster_priority: a reason is required to set critical priority' using errcode = '22023';
  end if;

  v_previous_priority := v_cluster.priority;

  update public.incident_clusters
  set priority = p_priority
  where id = p_cluster_id
  returning * into v_cluster;

  perform public.append_audit_event(
    'incident_cluster',
    p_cluster_id,
    'incident_cluster.priority_changed',
    jsonb_build_object('old_priority', v_previous_priority, 'new_priority', p_priority, 'reason', p_reason)
  );

  return v_cluster;
end;
$$;

grant execute on function public.set_incident_cluster_priority(uuid, public.priority_level, text) to authenticated;
