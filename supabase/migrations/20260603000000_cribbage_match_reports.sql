# ─────────────────────────────────────────────
# Changelog
#   v2026-06-03.1 — New table: per-match self-reported cribbage scores
#   v2026-06-03.2 — Support guest opponents (no app): opponent_id nullable,
#                   add opponent_name; exactly one must be set.
# ─────────────────────────────────────────────
--
-- cribbage_match_reports
-- Each cribbage player plays 3 matches per night. Players self-report each
-- match (opponent, win/loss, point spread) from their own phone. A match is
-- "confirmed" when both players' reports mirror each other. Scores are trusted
-- and count toward the nightly total immediately (no staff confirmation).
--
-- An opponent may not have the app. In that case opponent_id is NULL and the
-- reporting player types the opponent's name into opponent_name. The guest then
-- appears on the nightly board (record derived from the app player's mirror
-- result) but earns no points — there's no account to credit.
-- Run in Supabase Dashboard → SQL Editor.

CREATE TABLE IF NOT EXISTS public.cribbage_match_reports (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id     uuid        NOT NULL REFERENCES public.leaderboard_periods(id) ON DELETE CASCADE,
  reporter_id   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Opponent is either an app user (opponent_id) OR a guest (opponent_name).
  opponent_id   uuid        REFERENCES public.profiles(id) ON DELETE CASCADE,
  opponent_name text,
  match_number  int         NOT NULL CHECK (match_number BETWEEN 1 AND 3),
  won           boolean     NOT NULL,
  -- Point spread from the reporter's perspective (positive = reporter ahead).
  spread        int         NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- One report per player per match slot per night.
  UNIQUE (period_id, reporter_id, match_number),
  -- Exactly one of opponent_id / opponent_name must be provided.
  CONSTRAINT cribbage_opponent_present CHECK (
    (opponent_id IS NOT NULL AND opponent_name IS NULL)
    OR (opponent_id IS NULL AND opponent_name IS NOT NULL)
  )
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
