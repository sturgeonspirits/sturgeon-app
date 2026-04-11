-- Migration: performance indexes
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
--
-- Adds indexes for the slow paths identified in the consumer leaderboard page,
-- the toast sync delta calculation, and the staff score-entry screen.
-- All IF NOT EXISTS so it is safe to re-run.

-- ─── earn_events ─────────────────────────────────────────────────────────────

-- Toast import delta: queries by (context_type='toast_import', context_id in (...))
CREATE INDEX IF NOT EXISTS earn_events_context_idx
  ON public.earn_events (context_type, context_id);

-- Profile history feed: user's most-recent events
CREATE INDEX IF NOT EXISTS earn_events_user_created_idx
  ON public.earn_events (user_id, created_at DESC);

-- ─── leaderboard_events ──────────────────────────────────────────────────────

-- Upsert conflict target + per-period lookups for a specific user
CREATE UNIQUE INDEX IF NOT EXISTS leaderboard_events_period_user_uniq
  ON public.leaderboard_events (period_id, user_id);

-- ─── leaderboard_periods ─────────────────────────────────────────────────────

-- Consumer standings page fetches active single_night periods per event type
CREATE INDEX IF NOT EXISTS leaderboard_periods_type_kind_idx
  ON public.leaderboard_periods (event_type_id, period_type);

-- Staff score entry page lists open periods
CREATE INDEX IF NOT EXISTS leaderboard_periods_open_idx
  ON public.leaderboard_periods (is_finalized, starts_at DESC)
  WHERE is_finalized = false;

-- ─── leaderboard_teams / team_members ────────────────────────────────────────

CREATE INDEX IF NOT EXISTS leaderboard_teams_period_idx
  ON public.leaderboard_teams (period_id);

CREATE INDEX IF NOT EXISTS leaderboard_team_members_team_idx
  ON public.leaderboard_team_members (team_id);

CREATE INDEX IF NOT EXISTS leaderboard_team_members_user_idx
  ON public.leaderboard_team_members (user_id);

-- ─── events ──────────────────────────────────────────────────────────────────

-- Staff score-entry fetches events by (event_type_id, event_date BETWEEN ...)
CREATE INDEX IF NOT EXISTS events_type_date_idx
  ON public.events (event_type_id, event_date);

-- Consumer upcoming events query (not cancelled, future dates)
CREATE INDEX IF NOT EXISTS events_date_active_idx
  ON public.events (event_date)
  WHERE is_cancelled = false;

-- ─── mission_completion_requests ─────────────────────────────────────────────

-- Customer viewing their own pending request
CREATE INDEX IF NOT EXISTS mission_completion_requests_user_idx
  ON public.mission_completion_requests (user_id, status);

-- Staff queue: pending requests sorted by creation time
CREATE INDEX IF NOT EXISTS mission_completion_requests_pending_queue_idx
  ON public.mission_completion_requests (created_at)
  WHERE status = 'pending';

-- ─── reward_redemptions ──────────────────────────────────────────────────────

-- Avoid full scan when checking a user's pending/redeemed list
CREATE INDEX IF NOT EXISTS reward_redemptions_user_status_idx
  ON public.reward_redemptions (user_id, status);

-- ─── permanent_teams ─────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS permanent_teams_event_type_idx
  ON public.permanent_teams (event_type_id);

-- ─── profiles ────────────────────────────────────────────────────────────────

-- Quick role lookups for auth checks (small table, but partial index is cheap)
CREATE INDEX IF NOT EXISTS profiles_role_idx
  ON public.profiles (role)
  WHERE role IN ('staff', 'admin');

-- ─── Analyze so the planner notices the new indexes ─────────────────────────
ANALYZE public.earn_events;
ANALYZE public.leaderboard_events;
ANALYZE public.leaderboard_periods;
ANALYZE public.leaderboard_teams;
ANALYZE public.leaderboard_team_members;
ANALYZE public.events;
ANALYZE public.mission_completion_requests;
ANALYZE public.reward_redemptions;
ANALYZE public.permanent_teams;
ANALYZE public.profiles;
