-- Fix the permanent_teams → leaderboard_teams foreign key to cascade on delete.
-- The original ALTER TABLE in 20260327 added the FK without ON DELETE CASCADE,
-- so deleting a permanent_team fails if any leaderboard_teams rows reference it.

ALTER TABLE public.leaderboard_teams
  DROP CONSTRAINT IF EXISTS leaderboard_teams_permanent_team_id_fkey;

ALTER TABLE public.leaderboard_teams
  ADD CONSTRAINT leaderboard_teams_permanent_team_id_fkey
  FOREIGN KEY (permanent_team_id)
  REFERENCES public.permanent_teams(id)
  ON DELETE CASCADE;
