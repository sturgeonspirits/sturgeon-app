-- Enable RLS on tables that were missing it
-- Run in Supabase Dashboard → SQL Editor

-- ── events ────────────────────────────────────────────────────────────────────
-- Scheduled event dates (cribbage nights, trivia nights, etc.)
-- Anyone can read upcoming events; only service role (staff) can write.

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events are publicly readable"
  ON public.events FOR SELECT
  USING (true);

-- INSERT / UPDATE / DELETE go through service client (staff API routes) only.
-- No anon/authenticated write policy needed — service role bypasses RLS.


-- ── permanent_teams ───────────────────────────────────────────────────────────
-- Team identities that persist across leaderboard periods.
-- Anyone can read; only service role writes.

ALTER TABLE public.permanent_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permanent teams are publicly readable"
  ON public.permanent_teams FOR SELECT
  USING (true);

-- ── Verification ──────────────────────────────────────────────────────────────
-- After running, Supabase security advisor should show no rls_disabled_in_public
-- warnings for these tables.
