-- Realtime publication — the tables whose live updates actually matter for
-- UX responsiveness per docs/adr/0002-supabase-platform.md ("used for the
-- live Verifier queue, live Coordinator map... Postgres remains the system
-- of record"). Not every table needs to be realtime-published — only the
-- ones with a genuine live-update use case documented in
-- docs/product/SCREEN_INVENTORY.md.

-- reports: Verifier's Antrean Verifikasi queue updates live as new reports
-- reach analysis_completed/needs_manual_review; Coordinator's Command
-- Center/Peta Krisis updates live as reports become verified.
alter publication supabase_realtime add table public.reports;

-- response_tasks: Coordinator's Tugas Respons list and Command Center
-- reflect live status changes as assignees acknowledge/start/complete tasks.
alter publication supabase_realtime add table public.response_tasks;

-- notifications: every role's Notifikasi screen (docs/product/SCREEN_INVENTORY.md
-- "Shared Notifikasi Pattern") needs new notifications to appear live.
alter publication supabase_realtime add table public.notifications;

-- analysis_jobs: System Administrator's Kesehatan Sistem screen shows live
-- queue depth/status.
alter publication supabase_realtime add table public.analysis_jobs;
