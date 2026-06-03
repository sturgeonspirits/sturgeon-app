-- ─────────────────────────────────────────────
-- Changelog
--   v2026-06-02.0 — Enable RLS on trivia_teams + trivia_team_members (Supabase linter 0013 / rls_disabled_in_public)
-- ─────────────────────────────────────────────
--
-- Both tables were exposed through PostgREST in the public schema with RLS
-- disabled, meaning anyone with the anon key could read/write/delete rows.
--
-- The app only ever touches these tables via createServiceClient() (service_role)
-- behind requireStaff() in app/api/staff/trivia-teams/route.ts. service_role
-- bypasses RLS, so enabling RLS with NO policies locks out the public/anon API
-- without affecting the app. Add policies later only if these tables are ever
-- read directly from the browser.
--
-- Idempotent — safe to re-run.

alter table public.trivia_teams        enable row level security;
alter table public.trivia_team_members enable row level security;
