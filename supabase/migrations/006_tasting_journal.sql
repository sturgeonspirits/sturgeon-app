-- ══════════════════════════════════════════════════════════════
-- Migration 006: Tasting journal & cocktail catalogue
-- Private to each user. Triggers journal_entry earn events.
-- ══════════════════════════════════════════════════════════════

-- Spirits & cocktails catalogue (the Shanty integration target)
CREATE TABLE public.spirits (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL,
  category    text NOT NULL
                CHECK (category IN ('whiskey','gin','vodka','rum','brandy','liqueur','beer','wine','cocktail','other')),
  subcategory text,            -- 'single malt', 'London dry', etc.
  producer    text,
  region      text,
  abv         numeric(5,2),    -- 40.50
  description text,
  image_url   text,
  -- Sturgeon house spirits
  is_house    boolean DEFAULT false,
  is_featured boolean DEFAULT false,
  is_active   boolean DEFAULT true,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

-- Tasting journal entries — private per user (RLS enforced)
CREATE TABLE public.tasting_logs (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  spirit_id     uuid REFERENCES public.spirits(id),
  -- Free-form entry if spirit not in catalogue
  spirit_name   text,
  spirit_category text,
  -- Tasting notes
  nose          text,
  palate        text,
  finish        text,
  overall_notes text,
  rating        integer CHECK (rating BETWEEN 1 AND 5),
  -- Visit context
  location_id   uuid REFERENCES public.locations(id),
  visited_at    timestamptz DEFAULT now(),
  -- Linked earn event
  earn_event_id uuid REFERENCES public.earn_events(id),
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX tl_user_id_idx   ON public.tasting_logs (user_id);
CREATE INDEX tl_spirit_id_idx ON public.tasting_logs (spirit_id);
CREATE INDEX tl_visited_at_idx ON public.tasting_logs (visited_at DESC);

-- Push notification support (Phase 1 scaffolding, Phase 2 activation)
CREATE TABLE public.push_subscriptions (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint     text NOT NULL UNIQUE,
  p256dh       text NOT NULL,
  auth         text NOT NULL,
  user_agent   text,
  created_at   timestamptz DEFAULT now(),
  last_used_at timestamptz
);

CREATE TABLE public.notification_preferences (
  user_id            uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  leaderboard_results boolean DEFAULT true,
  mission_completed   boolean DEFAULT true,
  new_events          boolean DEFAULT true,
  points_earned       boolean DEFAULT false,  -- can be noisy, off by default
  updated_at          timestamptz DEFAULT now()
);

-- ── Seed a handful of house spirits ────────────────────────
INSERT INTO public.spirits (name, category, producer, is_house, is_featured, description) VALUES
  ('House Whiskey',    'whiskey', 'Sturgeon Spirits', true, true,  'Our flagship expression — smooth, approachable'),
  ('Barrel Aged Gin',  'gin',     'Sturgeon Spirits', true, true,  'London dry rested in ex-bourbon casks'),
  ('Seasonal Vodka',   'vodka',   'Sturgeon Spirits', true, false, 'Rotating seasonal expression');

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE public.spirits                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasting_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Spirits: public read
CREATE POLICY "spirits: public read" ON public.spirits FOR SELECT USING (is_active = true);
CREATE POLICY "spirits: staff write" ON public.spirits FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('staff','admin')));

-- Tasting logs: strictly private — only the owner
CREATE POLICY "tasting_logs: own all" ON public.tasting_logs FOR ALL USING (auth.uid() = user_id);

-- Push subscriptions: own only
CREATE POLICY "push_subscriptions: own all"       ON public.push_subscriptions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "notification_preferences: own all" ON public.notification_preferences FOR ALL USING (auth.uid() = user_id);
