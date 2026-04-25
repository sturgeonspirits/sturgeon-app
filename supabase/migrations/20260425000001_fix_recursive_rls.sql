-- ─────────────────────────────────────────────
-- Changelog
--   v2026-04-25.1 — Fix recursive RLS on profiles + copy-paste victims (audit P0-1)
-- ─────────────────────────────────────────────
--
-- The original schema dump installed staff-read policies that query `profiles`
-- to check the caller's role — but `profiles` itself has RLS enabled, so the
-- inner SELECT re-evaluates the same policy. Supabase's well-known footgun.
--
-- This migration:
--   1. Adds a SECURITY DEFINER helper (`public.is_staff(uid)`) that bypasses RLS.
--   2. Drops the recursive policies and recreates them using the helper.
--
-- Idempotent — safe to re-run.

-- ── 1. Helper function ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_staff(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid AND role IN ('staff', 'admin')
  );
$$;

-- Allow callers to invoke it
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;

-- ── 2. Replace recursive policies ─────────────────────────────────────────────

-- profiles
DROP POLICY IF EXISTS "profiles: staff read" ON public.profiles;
CREATE POLICY "profiles: staff read"
  ON public.profiles FOR SELECT
  USING ( public.is_staff(auth.uid()) );

-- earn_events
DROP POLICY IF EXISTS "earn_events: staff read" ON public.earn_events;
CREATE POLICY "earn_events: staff read"
  ON public.earn_events FOR SELECT
  USING ( public.is_staff(auth.uid()) );

-- mission_completions
DROP POLICY IF EXISTS "mission_completions: staff read" ON public.mission_completions;
CREATE POLICY "mission_completions: staff read"
  ON public.mission_completions FOR SELECT
  USING ( public.is_staff(auth.uid()) );

-- points_ledger
DROP POLICY IF EXISTS "points_ledger: staff read" ON public.points_ledger;
CREATE POLICY "points_ledger: staff read"
  ON public.points_ledger FOR SELECT
  USING ( public.is_staff(auth.uid()) );

-- qr_tokens
DROP POLICY IF EXISTS "qr_tokens: staff read" ON public.qr_tokens;
CREATE POLICY "qr_tokens: staff read"
  ON public.qr_tokens FOR SELECT
  USING ( public.is_staff(auth.uid()) );

-- reward_redemptions (FOR ALL — staff can read/insert/update/delete)
DROP POLICY IF EXISTS "reward_redemptions: staff all" ON public.reward_redemptions;
CREATE POLICY "reward_redemptions: staff all"
  ON public.reward_redemptions
  USING ( public.is_staff(auth.uid()) );

-- spirits (FOR ALL — staff write access)
DROP POLICY IF EXISTS "spirits: staff write" ON public.spirits;
CREATE POLICY "spirits: staff write"
  ON public.spirits
  USING ( public.is_staff(auth.uid()) );

-- leaderboard_events (FOR ALL — staff write)
DROP POLICY IF EXISTS "leaderboard_events: staff write" ON public.leaderboard_events;
CREATE POLICY "leaderboard_events: staff write"
  ON public.leaderboard_events
  USING ( public.is_staff(auth.uid()) );

-- leaderboard_team_members (FOR ALL — staff write)
DROP POLICY IF EXISTS "leaderboard_team_members: staff write" ON public.leaderboard_team_members;
CREATE POLICY "leaderboard_team_members: staff write"
  ON public.leaderboard_team_members
  USING ( public.is_staff(auth.uid()) );

-- leaderboard_teams (FOR ALL — staff write)
DROP POLICY IF EXISTS "leaderboard_teams: staff write" ON public.leaderboard_teams;
CREATE POLICY "leaderboard_teams: staff write"
  ON public.leaderboard_teams
  USING ( public.is_staff(auth.uid()) );

-- announcements (just shipped — also uses the recursive pattern)
DROP POLICY IF EXISTS "announcements: staff read" ON public.announcements;
CREATE POLICY "announcements: staff read"
  ON public.announcements FOR SELECT
  TO authenticated
  USING ( public.is_staff(auth.uid()) );

NOTIFY pgrst, 'reload schema';
