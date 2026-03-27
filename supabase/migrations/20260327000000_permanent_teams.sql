-- ── Persistent team identities ──────────────────────────────────────────────
-- Teams should survive across weeks. A "permanent team" is identified by
-- event_type + name. leaderboard_teams becomes the per-period score record.

-- 1. Permanent teams table
CREATE TABLE IF NOT EXISTS public.permanent_teams (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type_id uuid        NOT NULL REFERENCES public.event_types(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(event_type_id, name)
);

-- 2. Add permanent_team_id column to leaderboard_teams
ALTER TABLE public.leaderboard_teams
  ADD COLUMN IF NOT EXISTS permanent_team_id uuid REFERENCES public.permanent_teams(id);

-- 3. Unique constraint: one row per (period, permanent team)
DO $$ BEGIN
  ALTER TABLE public.leaderboard_teams
    ADD CONSTRAINT leaderboard_teams_period_pteam_key UNIQUE (period_id, permanent_team_id);
EXCEPTION WHEN duplicate_table THEN NULL;
         WHEN others           THEN NULL;
END $$;

-- 4. Unique constraint: one row per (period, team name) — catches accidental dupes
DO $$ BEGIN
  ALTER TABLE public.leaderboard_teams
    ADD CONSTRAINT leaderboard_teams_period_name_key UNIQUE (period_id, name);
EXCEPTION WHEN duplicate_table THEN NULL;
         WHEN others           THEN NULL;
END $$;

-- 5. Backfill: seed permanent_teams from existing leaderboard_teams rows
INSERT INTO public.permanent_teams (event_type_id, name)
SELECT DISTINCT lp.event_type_id, lt.name
FROM   public.leaderboard_teams lt
JOIN   public.leaderboard_periods lp ON lt.period_id = lp.id
ON CONFLICT (event_type_id, name) DO NOTHING;

-- 6. Link existing leaderboard_teams rows to their permanent_teams
-- (cannot reference the update target "lt" inside a FROM...JOIN, so use WHERE)
UPDATE public.leaderboard_teams lt
SET    permanent_team_id = pt.id
FROM   public.leaderboard_periods lp,
       public.permanent_teams pt
WHERE  lt.period_id = lp.id
AND    pt.event_type_id = lp.event_type_id
AND    pt.name = lt.name
AND    lt.permanent_team_id IS NULL;
