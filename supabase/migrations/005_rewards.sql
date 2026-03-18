-- ══════════════════════════════════════════════════════════════
-- Migration 005: Rewards catalogue & redemptions
-- 6 redemption methods — all driven by DB config.
-- ══════════════════════════════════════════════════════════════

CREATE TYPE public.redemption_method AS ENUM (
  'points',         -- customer spends points manually
  'leaderboard',    -- auto-awarded on leaderboard result
  'milestone',      -- trigger on cumulative stat (10 career wins)
  'streak',         -- trigger on consecutive achievement
  'tier_unlock',    -- unlocked on reaching a tier
  'staff_grant'     -- manual staff award
);

CREATE TABLE public.rewards (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name              text NOT NULL,
  description       text,
  icon              text DEFAULT '🎁',
  redemption_method redemption_method NOT NULL,
  points_cost       integer DEFAULT 0,   -- only relevant for 'points' method
  -- JSON config per redemption_method:
  -- points:      {}
  -- leaderboard: {"event_type_slug":"cribbage","min_placement":1}
  -- milestone:   {"stat":"career_wins","threshold":10,"event_type_slug":"cribbage"}
  -- streak:      {"stat":"consecutive_wins","threshold":3,"event_type_slug":"cribbage"}
  -- tier_unlock: {"tier":"spearer"}
  -- staff_grant: {}
  trigger_params    jsonb DEFAULT '{}',
  -- What the customer receives
  reward_type       text NOT NULL DEFAULT 'drink'
                      CHECK (reward_type IN ('drink','discount','merchandise','experience','points_bonus','custom')),
  reward_value      text,          -- '1 free cocktail', '10% off', etc.
  -- Limits
  is_active         boolean DEFAULT true,
  max_per_user      integer,       -- null = unlimited
  total_supply      integer,       -- null = unlimited
  redeemed_count    integer DEFAULT 0,
  -- Display
  tier_required     text DEFAULT 'newcomer',
  sort_order        integer DEFAULT 0,
  expires_at        timestamptz,
  created_at        timestamptz DEFAULT now()
);

-- Seed rewards catalogue
INSERT INTO public.rewards (name, description, icon, redemption_method, points_cost, trigger_params, reward_type, reward_value, sort_order) VALUES
  ('Free Welcome Cocktail',     'Redeem 500 points for a cocktail',             '🍹', 'points',      500,  '{}',                                                              'drink',       '1 free cocktail at the bar',  1),
  ('10% Spirits Discount',      'Redeem 1000 points for a bottle discount',     '🥃', 'points',      1000, '{}',                                                              'discount',    '10% off a bottle purchase',   2),
  ('Cribbage Weekly Winner',    'Win the weekly cribbage leaderboard',          '🃏', 'leaderboard', 0,    '{"event_type_slug":"cribbage","min_placement":1}',                'drink',       '1 free drink',                3),
  ('Trivia Night Winner',       'Win the weekly individual trivia',             '🎤', 'leaderboard', 0,    '{"event_type_slug":"trivia-individual","min_placement":1}',       'drink',       '1 free drink',                4),
  ('Trivia Team Champions',     'Win the weekly team trivia',                   '🏆', 'leaderboard', 0,    '{"event_type_slug":"trivia-team","min_placement":1}',             'drink',       '1 free drink each',           5),
  ('Cribbage Milestone',        '10 career cribbage wins',                      '♟️', 'milestone',   0,    '{"stat":"career_wins","threshold":10,"event_type_slug":"cribbage"}','experience','VIP table for one event',     6),
  ('Hot Streak',                '3 consecutive cribbage wins',                  '🔥', 'streak',      0,    '{"stat":"consecutive_wins","threshold":3,"event_type_slug":"cribbage"}','merchandise','Sturgeon pint glass',        7),
  ('Spearer Welcome Gift',      'Reach Spearer tier',                           '🥇', 'tier_unlock', 0,    '{"tier":"spearer"}',                                              'drink',       'Free tasting flight',         8);

-- Reward redemptions — two-step: pending → redeemed
CREATE TABLE public.reward_redemptions (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reward_id    uuid NOT NULL REFERENCES public.rewards(id),
  earn_event_id uuid REFERENCES public.earn_events(id),  -- points_delta recorded here
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','redeemed','expired','cancelled')),
  -- Fulfillment
  redeemed_at  timestamptz,
  redeemed_by  uuid REFERENCES public.profiles(id),   -- staff member who fulfilled
  notes        text,
  created_at   timestamptz DEFAULT now(),
  expires_at   timestamptz DEFAULT (now() + interval '30 days')
);

CREATE INDEX rr_user_id_idx  ON public.reward_redemptions (user_id);
CREATE INDEX rr_status_idx   ON public.reward_redemptions (status);

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE public.rewards             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_redemptions  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rewards: public read"              ON public.rewards FOR SELECT USING (is_active = true);
CREATE POLICY "reward_redemptions: own read"      ON public.reward_redemptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "reward_redemptions: staff all"     ON public.reward_redemptions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('staff','admin')));
