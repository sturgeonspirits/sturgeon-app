-- ══════════════════════════════════════════════════════════════
-- Migration 003: Missions, Challenges & QR tokens
-- Add new missions/challenges via DB rows — no code changes.
-- ══════════════════════════════════════════════════════════════

-- How a mission gets marked complete
CREATE TYPE public.completion_trigger AS ENUM (
  'qr_scan',           -- customer scans staff QR code
  'manual_staff',      -- staff taps "mark complete" in console
  'journal_entry',     -- user submits a tasting journal entry
  'toast_purchase',    -- purchase recorded from Toast POS (Phase 2)
  'event_attendance',  -- awarded by leaderboard function on participation
  'challenge_completion' -- completing a parent challenge
);

-- Missions: individual point-earning tasks
CREATE TABLE public.missions (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug               text NOT NULL UNIQUE,        -- 'first-visit', 'taste-three-spirits'
  title              text NOT NULL,
  description        text,
  icon               text DEFAULT '🎯',
  points             integer NOT NULL DEFAULT 50,
  completion_trigger completion_trigger NOT NULL,
  -- Constraints
  is_repeatable      boolean DEFAULT false,       -- can be earned multiple times
  repeat_limit       integer,                     -- null = unlimited if repeatable
  repeat_cooldown_days integer,                   -- days between repeat completions
  -- Targeting
  min_tier           text DEFAULT 'newcomer',     -- tier required to see/earn
  is_active          boolean DEFAULT true,
  sort_order         integer DEFAULT 0,
  -- Future extensibility
  metadata           jsonb DEFAULT '{}',          -- any extra config
  created_at         timestamptz DEFAULT now()
);

-- Seed core missions
INSERT INTO public.missions (slug, title, description, icon, points, completion_trigger, is_repeatable, sort_order) VALUES
  ('first-visit',         'First Visit',          'Check in on your first visit to the distillery',  '🥂', 100, 'qr_scan',       false, 1),
  ('taste-a-spirit',      'Taste a Spirit',       'Log your first tasting journal entry',            '🥃', 75,  'journal_entry', false, 2),
  ('taste-three-spirits', 'Spirit Curious',       'Log three different spirits in your journal',     '🔍', 150, 'journal_entry', false, 3),
  ('attend-trivia',       'Smartish',             'Participate in a trivia night',                   '🎤', 50,  'event_attendance', true, 4),
  ('attend-cribbage',     'On the Board',         'Play in Cocktails & Cribbage',                    '🃏', 50,  'event_attendance', true, 5),
  ('win-trivia',          'Big Brain',            'Win or place top 3 in trivia',                    '🏆', 200, 'event_attendance', true, 6),
  ('win-cribbage',        'Peg Master',           'Win a cribbage match',                            '♟️', 150, 'event_attendance', true, 7),
  ('refer-friend',        'Bring a Spearer',      'Refer a friend who joins the club',               '👥', 200, 'manual_staff',  true,  8),
  ('weekly-checkin',      'Regular',              'Check in 4 Saturdays in a row',                   '📅', 300, 'qr_scan',       true,  9);

-- Mission completions: one row per user per mission (or per occurrence if repeatable)
CREATE TABLE public.mission_completions (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mission_id   uuid NOT NULL REFERENCES public.missions(id),
  earn_event_id uuid REFERENCES public.earn_events(id),   -- links back to the points record
  completed_at timestamptz DEFAULT now(),
  completed_by uuid REFERENCES public.profiles(id),       -- staff member who confirmed (if manual)
  notes        text,
  UNIQUE (user_id, mission_id, completed_at)               -- uniqueness per occurrence timestamp
);

CREATE INDEX mc_user_id_idx    ON public.mission_completions (user_id);
CREATE INDEX mc_mission_id_idx ON public.mission_completions (mission_id);

-- Challenges: groups of missions with a bonus reward on completion
CREATE TABLE public.challenges (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug         text NOT NULL UNIQUE,
  title        text NOT NULL,
  description  text,
  icon         text DEFAULT '🏅',
  bonus_points integer NOT NULL DEFAULT 0,
  -- A challenge is complete when all linked missions are complete
  is_active    boolean DEFAULT true,
  starts_at    timestamptz,              -- null = always active
  ends_at      timestamptz,             -- null = no expiry
  sort_order   integer DEFAULT 0,
  metadata     jsonb DEFAULT '{}',
  created_at   timestamptz DEFAULT now()
);

-- Which missions are required for each challenge
CREATE TABLE public.challenge_missions (
  challenge_id uuid REFERENCES public.challenges(id) ON DELETE CASCADE,
  mission_id   uuid REFERENCES public.missions(id),
  PRIMARY KEY (challenge_id, mission_id)
);

-- Seed a starter challenge
INSERT INTO public.challenges (slug, title, description, icon, bonus_points, sort_order)
VALUES ('welcome-to-the-club', 'Welcome to the Club', 'Complete your first visit and first tasting', '🎖️', 100, 1);

INSERT INTO public.challenge_missions (challenge_id, mission_id)
SELECT c.id, m.id
FROM public.challenges c, public.missions m
WHERE c.slug = 'welcome-to-the-club'
  AND m.slug IN ('first-visit', 'taste-a-spirit');

-- Challenge completions
CREATE TABLE public.challenge_completions (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  challenge_id uuid NOT NULL REFERENCES public.challenges(id),
  earn_event_id uuid REFERENCES public.earn_events(id),
  completed_at timestamptz DEFAULT now(),
  UNIQUE (user_id, challenge_id)
);

-- QR tokens (staff generates; customer scans to complete qr_scan missions)
CREATE TABLE public.qr_tokens (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  token       text NOT NULL UNIQUE,   -- HMAC-signed JWT, 15-min TTL
  mission_id  uuid REFERENCES public.missions(id),
  location_id uuid REFERENCES public.locations(id),
  created_by  uuid REFERENCES public.profiles(id),
  created_at  timestamptz DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  used_count  integer DEFAULT 0       -- how many times scanned (for multi-use codes)
);

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE public.missions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_completions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_missions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_tokens             ENABLE ROW LEVEL SECURITY;

CREATE POLICY "missions: public read"          ON public.missions FOR SELECT USING (is_active = true);
CREATE POLICY "mission_completions: own read"  ON public.mission_completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "mission_completions: staff read" ON public.mission_completions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('staff','admin')));
CREATE POLICY "challenges: public read"        ON public.challenges FOR SELECT USING (is_active = true);
CREATE POLICY "challenge_missions: public read" ON public.challenge_missions FOR SELECT USING (true);
CREATE POLICY "challenge_completions: own read" ON public.challenge_completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "qr_tokens: staff read"         ON public.qr_tokens FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('staff','admin')));
