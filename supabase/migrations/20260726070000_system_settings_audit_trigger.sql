-- BLOCK 27 — "every admin setting change is audited" acceptance criterion.
-- Research confirmed a real gap: BLOCK 25's updateEscalationSetting() wrote
-- directly to system_settings with no append_audit_event call anywhere,
-- and no other write path audited it either. A trigger (not a TypeScript
-- change) is the fix here specifically because it makes the guarantee
-- unconditional — it covers the existing escalation-settings write path
-- retroactively AND every future admin-settings write this block adds
-- (Pengguna/Event/Integrasi/Pengaturan), without requiring every call site
-- to remember to audit itself. This mirrors archive_report()'s existing
-- inline append_audit_event pattern in spirit, just expressed as a trigger
-- since system_settings has many independent call sites rather than one
-- RPC.

create function public.audit_system_settings_change()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if (tg_op = 'UPDATE') then
    if new.value is distinct from old.value then
      perform public.append_audit_event(
        'system_setting',
        new.id,
        'system_setting.updated',
        jsonb_build_object('key', new.key, 'old_value', old.value, 'new_value', new.value)
      );
    end if;
    return new;
  elsif (tg_op = 'INSERT') then
    perform public.append_audit_event(
      'system_setting',
      new.id,
      'system_setting.created',
      jsonb_build_object('key', new.key, 'value', new.value)
    );
    return new;
  end if;
  return null;
end;
$$;

create trigger system_settings_audit_trigger
  after insert or update on public.system_settings
  for each row
  execute function public.audit_system_settings_change();

comment on function public.audit_system_settings_change() is
  'Writes an audit_events row for every system_settings insert/update, unconditionally — this is what makes "every admin setting change is audited" (BLOCK 27) a database-enforced guarantee rather than something each TypeScript call site must remember to do.';
comment on trigger system_settings_audit_trigger on public.system_settings is
  'BLOCK 27 — see audit_system_settings_change() comment. Fires on every write regardless of caller (closes a gap where BLOCK 25''s escalation-settings UPDATE was never audited).';
