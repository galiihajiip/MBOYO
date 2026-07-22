-- BLOCK 24 — response_tasks needs real, queryable columns for the fields
-- this block's prompt requires the Tugas Respons screens to filter/sort/
-- display on: category, description, due_at, resources. Without these as
-- columns, "overdue tasks" (a required dashboard metric) and any
-- category/due-time filter on the Tugas Respons list would have no way to
-- query except scanning audit_events' jsonb detail — audit_events is an
-- append-only log, not meant to be the query surface for current task
-- state, so these belong on response_tasks itself alongside status/priority.

alter table public.response_tasks
  add column category text,
  add column description text,
  add column due_at timestamptz,
  add column resources text;

comment on column public.response_tasks.category is 'Free-text response category (e.g. "Evakuasi", "Distribusi Logistik") set at task creation, per this block''s "category" field requirement.';
comment on column public.response_tasks.due_at is 'Coordinator-set due time — the basis for the "overdue tasks" dashboard metric (due_at < now() and status not in (completed, cancelled)).';
comment on column public.response_tasks.resources is 'Free-text resource notes (personnel/equipment/supplies) set at task creation; not a structured/typed resource ledger in this block''s scope.';

create index response_tasks_due_at_idx on public.response_tasks (due_at) where due_at is not null;
