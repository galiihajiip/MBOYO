-- BLOCK 28 — Privacy: consent versioning. A minimal, versioned,
-- account-level consent record: each row is one profile's acceptance of one
-- named consent document at one version, at a point in time. Purpose
-- limitation, retention notice, offline-storage notice, and the external
-- Gemini disclosure (docs/product/PRIVACY_MODEL.md) are all served as
-- static copy in the app UI — this table only needs to record THAT a
-- profile accepted a given version, not store the document text itself
-- (the document lives in docs/legal/ + the UI, versioned by `document_key` +
-- `version`, exactly like this codebase's model_registry_entry pattern
-- versions a model rather than duplicating its weights in a DB row).

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  document_key text not null,
  version text not null,
  accepted_at timestamptz not null default now(),
  unique (profile_id, document_key, version)
);

create index consent_records_profile_id_idx on public.consent_records (profile_id);

comment on table public.consent_records is
  'BLOCK 28 — versioned record of a profile accepting a named consent document (document_key) at a specific version. One row per (profile, document, version) acceptance; a profile re-accepting a bumped version inserts a new row rather than mutating the old one, preserving full acceptance history.';

alter table public.consent_records enable row level security;
alter table public.consent_records force row level security;

-- Every role may read/insert only its own consent records — this is a
-- self-service acceptance flow (like profile:update own), not an
-- Admin-managed resource. No update/delete policy exists at all: a consent
-- acceptance is an immutable historical fact, never edited or retracted in
-- place (a withdrawal would be its own new event/table, out of this
-- block's placeholder scope — see PRIVACY_MODEL.md).
create policy consent_records_select_own on public.consent_records
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = consent_records.profile_id
        and p.user_id = auth.uid()
    )
  );

create policy consent_records_insert_own on public.consent_records
  for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = consent_records.profile_id
        and p.user_id = auth.uid()
    )
  );

create policy consent_records_auditor_select on public.consent_records
  for select
  using (public.has_role('auditor'));

create policy consent_records_admin_select on public.consent_records
  for select
  using (public.has_role('system_administrator'));

-- record_consent — SECURITY DEFINER wrapper (mirrors place_legal_hold's
-- shape) purely so the audit event is appended atomically with the insert;
-- the RLS insert policy above would already permit a direct insert, but
-- routing through one RPC keeps "every consent acceptance is audited"
-- guaranteed the same way system_settings_audit_trigger guarantees it for
-- settings, without needing a second trigger for this one-insert-only table.
create function public.record_consent(
  p_document_key text,
  p_version text
)
returns public.consent_records
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_profile_id uuid;
  v_row public.consent_records;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'record_consent: no profile for current user' using errcode = '42501';
  end if;
  if p_document_key is null or length(trim(p_document_key)) = 0 then
    raise exception 'record_consent: document_key is required' using errcode = '22023';
  end if;
  if p_version is null or length(trim(p_version)) = 0 then
    raise exception 'record_consent: version is required' using errcode = '22023';
  end if;

  insert into public.consent_records (profile_id, document_key, version)
  values (v_profile_id, trim(p_document_key), trim(p_version))
  on conflict (profile_id, document_key, version) do nothing
  returning * into v_row;

  if v_row.id is null then
    select * into v_row
    from public.consent_records
    where profile_id = v_profile_id and document_key = trim(p_document_key) and version = trim(p_version);
  end if;

  perform public.append_audit_event(
    'consent_record',
    v_row.id,
    'consent_record.accepted',
    jsonb_build_object('documentKey', v_row.document_key, 'version', v_row.version)
  );

  return v_row;
end;
$$;

grant execute on function public.record_consent(text, text) to authenticated;
