# ─────────────────────────────────────────────
# Changelog
#   v2026-06-03.1 — New table: per-match self-reported cribbage scores
# ─────────────────────────────────────────────
--
-- cribbage_match_reports
-- Each cribbage player plays 3 matches per night. Players self-report each
-- match (opponent, win/loss, point spread) from their own phone. A match is
-- "confirmed" when both players' reports mirror each other. Scores are trusted
-- and count toward the nightly total immediately (no staff confirmation).
-- Run in Supabase Dashboard → SQL Editor.

CREATE TABLE IF NOT EXISTS public.cribbage_match_reports (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id     uuid        NOT NULL REFERENCES public.leaderboard_periods(id) ON DELETE CASCADE,
  reporter_id   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  opponent_id   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_number  int         NOT NULL CHECK (match_number BETWEEN 1 AND 3),
  won           boolean     NOT NULL,
  -- Point spread from the reporter's perspective (positive = reporter ahead).
  spread        int         NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- One report per player per match slot per night.
  UNIQUE (period_id, reporter_id, match_number)
);

CREATE INDEX IF NOT EXISTS idx_cribbage_match_reports_period
  ON public.cribbage_match_reports (period_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
-- Public read (standings are public). All writes go through the service client
-- in /api/events/match-report, so no anon/authenticated write policy is needed.
ALTER TABLE public.cribbage_match_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Match reports are publicly readable"
  ON public.cribbage_match_reports FOR SELECT
  USING (true);
