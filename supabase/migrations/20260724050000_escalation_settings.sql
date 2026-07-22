-- BLOCK 25 — configurable escalation settings. Per
-- docs/product/SCREEN_INVENTORY.md's "Aturan Eskalasi" section, escalation
-- rules are a `system_setting` subset (no dedicated table), so this
-- migration seeds one row per rule under the `escalation.` key namespace
-- rather than creating a new table — `system_settings` already has the
-- exact RLS this needs (any authenticated role reads, only
-- system_administrator writes), and the Admin's existing
-- /admin/eskalasi stub already documents this table as its data source.
--
-- Each rule's `value` jsonb carries { enabled, threshold fields...,
-- level }. Threshold values are seeded here as an explicit, disclosed
-- starting point (not derived from real operational data, matching this
-- codebase's established "provisional threshold" honesty posture — e.g.
-- BLOCK 23's SLA_WARNING_HOURS=24) — an Admin can change any of them via
-- system_settings' existing UPDATE path, and every read of these settings
-- at evaluation time re-reads the row, so a change takes effect on the
-- very next evaluation with no restart required (this block's explicit
-- "settings change behavior without restart" acceptance criterion).

insert into public.system_settings (organization_id, key, value)
select
  o.id,
  rule.key,
  rule.value
from public.organizations o
cross join (
  values
    (
      'escalation.verified_destroyed_threshold',
      '{"enabled": true, "minProbability": 0.7, "level": "high"}'::jsonb
    ),
    (
      'escalation.cluster_destroyed_radius',
      '{"enabled": true, "minCount": 3, "radiusMeters": 500, "windowHours": 24, "level": "critical"}'::jsonb
    ),
    (
      'escalation.verifier_sla_breach',
      '{"enabled": true, "hoursSinceSubmission": 24, "level": "warning"}'::jsonb
    ),
    (
      'escalation.task_overdue',
      '{"enabled": true, "level": "warning"}'::jsonb
    ),
    (
      'escalation.repeated_duplicate_source',
      '{"enabled": true, "minCount": 3, "windowHours": 24, "level": "warning"}'::jsonb
    ),
    (
      'escalation.repeated_analysis_failure',
      '{"enabled": true, "minFailures": 3, "windowHours": 6, "level": "high"}'::jsonb
    )
) as rule(key, value)
on conflict (organization_id, key) do nothing;

comment on table public.system_settings is
  'Org-scoped key/value settings. Escalation rules live here under the escalation.* key namespace (BLOCK 25) — see docs/product/SCREEN_INVENTORY.md "Aturan Eskalasi" for the Admin UI this backs.';
