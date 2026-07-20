-- Test-only setup: enables pgTAP for `supabase test db`. Not part of the
-- application migrations (pgtap is a test dependency, never needed in a
-- deployed environment) — this file runs only when tests execute.
create extension if not exists pgtap with schema extensions;
