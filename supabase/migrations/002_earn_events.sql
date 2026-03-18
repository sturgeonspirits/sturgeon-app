-- ══════════════════════════════════════════════════════════════
-- Migration 002: Earn Events — the central points ledger
-- RULE: Never write points directly. All mutations go through
--       earn_events. points_ledger is a materialized summary.
-- ══════════════════════════════════════════════════════════════

CREATE TYPE public.earn_event_type AS ENUM (
  'mission_completed',
  'journal_entry',
  'leaderboard_awarded',
  'reward_redeemed',       -- negative delta
  'tier_unlocked',
  'badge_awarded',
  'staff_adjustment',      -- manual correction by staff
  'purchase_recorded'      -- Toast POS hook (Phase 2)
);

CREATE TABLE public.earn_events (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type    earn_event_type NOT NULL,
  points_delta  integer NOT NULL DEFAULT 0,     -- positive = earn, negative = spend
  -- Optional context: what triggered this event
  context_type  text,   -- 'mission' | 'leaderboard_period' | 'journal_entry' | 'reward' | null
  context_id    uuid,   -- FK to the relevant table row (not enforced at DB level for flexibility)
  location_id   uuid REFERENCES public.locations(id),
  notes         text,   -- staff notes or system description
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX earn_events_user_id_idx     ON public.earn_events (user_id);
CREATE INDEX earn_events_event_type_idx  ON public.earn_events (event_type);
CREATE INDEX earn_events_created_at_idx  ON public.earn_events (created_at DESC);

-- Materialized summary (never write here directly)
CREATE TABLE public.points_ledger (
  user_id          uuid REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  balance          integer NOT NULL DEFAULT 0,
  lifetime_earned  integer NOT NULL DEFAULT 0,
  lifetime_spent   integer NOT NULL DEFAULT 0,
  last_updated_at  timestamptz DEFAULT now()
);

-- Trigger: keep points_ledger in sync after every earn_event insert
CREATE OR REPLACE FUNCTION public.sync_points_ledger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.points_ledger (user_id, balance, lifetime_earned, lifetime_spent, last_updated_at)
  VALUES (
    NEW.user_id,
    GREATEST(0, NEW.points_delta),
    CASE WHEN NEW.points_delta > 0 THEN NEW.points_delta ELSE 0 END,
    CASE WHEN NEW.points_delta < 0 THEN ABS(NEW.points_delta) ELSE 0 END,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    balance         = GREATEST(0, points_ledger.balance + NEW.points_delta),
    lifetime_earned = points_ledger.lifetime_earned + CASE WHEN NEW.points_delta > 0 THEN NEW.points_delta ELSE 0 END,
    lifetime_spent  = points_ledger.lifetime_spent  + CASE WHEN NEW.points_delta < 0 THEN ABS(NEW.points_delta) ELSE 0 END,
    last_updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER earn_event_sync_ledger
  AFTER INSERT ON public.earn_events
  FOR EACH ROW EXECUTE PROCEDURE public.sync_points_ledger();

-- Tier thresholds — edit these rows to tune tier progression
CREATE TABLE public.tier_thresholds (
  tier          text PRIMARY KEY CHECK (tier IN ('newcomer','regular','spearer','harpooner','captain')),
  min_lifetime  integer NOT NULL,   -- lifetime_earned required to reach this tier
  label         text NOT NULL,
  color         text NOT NULL,
  perks         jsonb DEFAULT '[]'  -- array of perk strings
);

INSERT INTO public.tier_thresholds (tier, min_lifetime, label, color, perks) VALUES
  ('newcomer',   0,    'Newcomer',   '#888888', '["Welcome drink discount"]'),
  ('regular',    500,  'Regular',    '#5aadff', '["10% off merchandise","Birthday bonus points"]'),
  ('spearer',    1500, 'Spearer',    '#f5c842', '["Free tasting","Monthly bonus","Priority event seating"]'),
  ('harpooner',  3500, 'Harpooner',  '#e87c3e', '["VIP events","10% spirits discount","Branded gift"]'),
  ('captain',    7500, 'Captain',    '#b06aff', '["Everything above","Barrel naming rights","Annual dinner"]');

-- Function: recalculate and update profile tier after ledger changes
CREATE OR REPLACE FUNCTION public.recalculate_tier(p_user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_lifetime  integer;
  v_new_tier  text;
  v_old_tier  text;
BEGIN
  SELECT lifetime_earned INTO v_lifetime FROM public.points_ledger WHERE user_id = p_user_id;
  SELECT tier INTO v_old_tier FROM public.profiles WHERE id = p_user_id;

  SELECT tier INTO v_new_tier
  FROM public.tier_thresholds
  WHERE min_lifetime <= COALESCE(v_lifetime, 0)
  ORDER BY min_lifetime DESC
  LIMIT 1;

  v_new_tier := COALESCE(v_new_tier, 'newcomer');

  IF v_new_tier <> v_old_tier THEN
    UPDATE public.profiles SET tier = v_new_tier WHERE id = p_user_id;
    -- Emit tier unlock earn event (zero points, just a record)
    INSERT INTO public.earn_events (user_id, event_type, points_delta, notes)
    VALUES (p_user_id, 'tier_unlocked', 0, 'Reached tier: ' || v_new_tier);
  END IF;

  RETURN v_new_tier;
END;
$$;

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE public.earn_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_ledger  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tier_thresholds ENABLE ROW LEVEL SECURITY;

-- earn_events: users see own; staff see all; INSERT via service role only
CREATE POLICY "earn_events: own read"   ON public.earn_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "earn_events: staff read" ON public.earn_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('staff','admin')));

-- points_ledger: users see own; staff see all
CREATE POLICY "points_ledger: own read"   ON public.points_ledger FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "points_ledger: staff read" ON public.points_ledger FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('staff','admin')));

-- tier_thresholds: public read
CREATE POLICY "tier_thresholds: public read" ON public.tier_thresholds FOR SELECT USING (true);
