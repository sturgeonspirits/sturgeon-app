-- ══════════════════════════════════════════════════════════════
-- Migration 004: Event types & leaderboards
-- Add new activities (darts, cornhole, etc.) via DB rows only.
-- No code changes needed for new event types.
-- ══════════════════════════════════════════════════════════════

-- Master list of competitive events
CREATE TABLE public.event_types (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name             text NOT NULL,
  slug             text NOT NULL UNIQUE,
  description      text,
  -- How scoring works: drives LeaderboardBoard component branching
  participant_type text NOT NULL DEFAULT 'individual'
                     CHECK (participant_type IN ('individual', 'team', 'both')),
  scoring_method   text NOT NULL DEFAULT 'points'
                     CHECK (scoring_method IN ('wins_losses', 'points', 'placement', 'time')),
  -- What missions get triggered on participation/winning
  participation_mission_slug text REFERENCES public.missions(slug),
  win_mission_slug           text REFERENCES public.missions(slug),
  -- Points awarded automatically (additional to any mission points)
  placement_points jsonb DEFAULT '{"1":100,"2":75,"3":50,"participant":25}',
  -- Display
  icon             text DEFAULT '🏆',
  color            text DEFAULT '#f5c842',
  day_of_week      integer CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sun, 4=Thu
  typical_time     text,     -- '7:00 PM'
  is_active        boolean DEFAULT true,
  sort_order       integer DEFAULT 0,
  created_at       timestamptz DEFAULT now()
);

-- Seed the three current competitive events
INSERT INTO public.event_types
  (name, slug, description, participant_type, scoring_method,
   participation_mission_slug, win_mission_slug,
   placement_points, icon, color, day_of_week, typical_time, sort_order)
VALUES
  (
    'Cocktails & Cribbage', 'cribbage',
    'Thursday night cribbage — individual matchplay',
    'individual', 'wins_losses',
    'attend-cribbage', 'win-cribbage',
    '{"win":150,"loss":50}',
    '🃏', '#e87c3e', 4, '7:00 PM', 1
  ),
  (
    'Smartish Trivia — Individual', 'trivia-individual',
    'Wednesday trivia, individual scoring',
    'individual', 'points',
    'attend-trivia', 'win-trivia',
    '{"1":200,"2":150,"3":100,"participant":50}',
    '🎤', '#5aadff', 3, '7:00 PM', 2
  ),
  (
    'Smartish Trivia — Teams', 'trivia-team',
    'Wednesday trivia, team scoring',
    'team', 'placement',
    'attend-trivia', 'win-trivia',
    '{"1":200,"2":150,"3":100,"participant":50}',
    '🎤', '#b06aff', 3, '7:00 PM', 3
  );
-- Future: INSERT INTO event_types (...) VALUES ('Darts Night', 'darts', ...) — zero code change.

-- Leaderboard periods: one row per occurrence of an event (weekly, season, etc.)
CREATE TABLE public.leaderboard_periods (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type_id  uuid NOT NULL REFERENCES public.event_types(id),
  label          text NOT NULL,              -- 'Week of March 18 2026', 'Season 1'
  period_type    text NOT NULL DEFAULT 'weekly'
                   CHECK (period_type IN ('single_night','weekly','monthly','season','all_time')),
  starts_at      timestamptz NOT NULL,
  ends_at        timestamptz,
  is_finalized   boolean DEFAULT false,      -- locked once scores are final
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX lp_event_type_idx ON public.leaderboard_periods (event_type_id);

-- Individual participant scores per period
CREATE TABLE public.leaderboard_events (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  period_id     uuid NOT NULL REFERENCES public.leaderboard_periods(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Cribbage: wins/losses; Trivia-individual: raw score; Trivia-team: set via team result
  score         integer DEFAULT 0,
  wins          integer DEFAULT 0,
  losses        integer DEFAULT 0,
  placement     integer,                    -- 1 = first place
  earn_event_id uuid REFERENCES public.earn_events(id),
  entered_by    uuid REFERENCES public.profiles(id),  -- staff member
  entered_at    timestamptz DEFAULT now(),
  notes         text,
  UNIQUE (period_id, user_id)
);

CREATE INDEX le_period_id_idx ON public.leaderboard_events (period_id);
CREATE INDEX le_user_id_idx   ON public.leaderboard_events (user_id);

-- Teams for team-based events
CREATE TABLE public.leaderboard_teams (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  period_id   uuid NOT NULL REFERENCES public.leaderboard_periods(id) ON DELETE CASCADE,
  name        text NOT NULL,
  score       integer DEFAULT 0,
  placement   integer,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE public.leaderboard_team_members (
  team_id  uuid REFERENCES public.leaderboard_teams(id) ON DELETE CASCADE,
  user_id  uuid REFERENCES public.profiles(id),
  PRIMARY KEY (team_id, user_id)
);

-- All-time aggregate view per event type (materialized on demand by Netlify function)
CREATE TABLE public.leaderboard_cache (
  event_type_id uuid REFERENCES public.event_types(id),
  user_id       uuid REFERENCES public.profiles(id),
  total_score       integer DEFAULT 0,
  total_wins        integer DEFAULT 0,
  total_losses      integer DEFAULT 0,
  events_attended   integer DEFAULT 0,
  best_placement    integer,
  last_updated_at   timestamptz DEFAULT now(),
  PRIMARY KEY (event_type_id, user_id)
);

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE public.event_types            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_periods    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_teams      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_cache      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_types: public read"         ON public.event_types FOR SELECT USING (is_active = true);
CREATE POLICY "leaderboard_periods: public read" ON public.leaderboard_periods FOR SELECT USING (true);
CREATE POLICY "leaderboard_events: public read"  ON public.leaderboard_events FOR SELECT USING (true);
CREATE POLICY "leaderboard_teams: public read"   ON public.leaderboard_teams FOR SELECT USING (true);
CREATE POLICY "leaderboard_team_members: public read" ON public.leaderboard_team_members FOR SELECT USING (true);
CREATE POLICY "leaderboard_cache: public read"   ON public.leaderboard_cache FOR SELECT USING (true);

-- Staff can insert/update scores
CREATE POLICY "leaderboard_events: staff write" ON public.leaderboard_events FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('staff','admin')));
CREATE POLICY "leaderboard_teams: staff write"  ON public.leaderboard_teams FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('staff','admin')));
CREATE POLICY "leaderboard_team_members: staff write" ON public.leaderboard_team_members FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('staff','admin')));
