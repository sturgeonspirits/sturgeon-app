-- Fix missing SELECT/INSERT/UPDATE/DELETE grants on team tables.
--
-- The initial schema dump only granted REFERENCES, TRIGGER, TRUNCATE, MAINTAIN
-- to leaderboard_teams and leaderboard_team_members — not the DML verbs.
-- permanent_teams (added in 20260327) received no grants at all.
--
-- Without these grants no role can actually read or write the tables,
-- regardless of RLS policies. Symptom: "permission denied for table ..."
-- even when using the service role client.

-- ── permanent_teams ───────────────────────────────────────────────────────────
GRANT SELECT                          ON public.permanent_teams TO anon;
GRANT SELECT                          ON public.permanent_teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE  ON public.permanent_teams TO service_role;

-- ── leaderboard_teams ─────────────────────────────────────────────────────────
GRANT SELECT                          ON public.leaderboard_teams TO anon;
GRANT SELECT                          ON public.leaderboard_teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE  ON public.leaderboard_teams TO service_role;

-- ── leaderboard_team_members ──────────────────────────────────────────────────
GRANT SELECT                          ON public.leaderboard_team_members TO anon;
GRANT SELECT                          ON public.leaderboard_team_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE  ON public.leaderboard_team_members TO service_role;

-- Notes:
-- • anon / authenticated only get SELECT — all writes go through API routes
--   that use the service role client, which also bypasses RLS.
-- • RLS policies on leaderboard_teams and leaderboard_team_members already
--   restrict writes to staff; these grants don't change that behaviour.
-- • permanent_teams SELECT policy (added in 20260408) remains in place for
--   public reads via the anon/authenticated roles.
