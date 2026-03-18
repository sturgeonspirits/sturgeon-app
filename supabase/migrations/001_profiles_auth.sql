-- ══════════════════════════════════════════════════════════════
-- Migration 001: Profiles & Auth foundation
-- Run after: Supabase project created, Auth enabled
-- ══════════════════════════════════════════════════════════════

-- Extend auth.users with app-specific profile data
CREATE TABLE public.profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text,
  phone         text,
  display_name  text,
  avatar_url    text,
  role          text NOT NULL DEFAULT 'customer'
                  CHECK (role IN ('customer', 'staff', 'admin')),
  -- Loyalty tier
  tier          text NOT NULL DEFAULT 'newcomer'
                  CHECK (tier IN ('newcomer', 'regular', 'spearer', 'harpooner', 'captain')),
  -- Future: Toast POS link (nullable, wired in Phase 2)
  pos_customer_id text,
  -- Timestamps
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, phone, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Keep updated_at current
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Locations (bar, events, etc.) — used for context on earn_events
CREATE TABLE public.locations (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  address     text,
  lat         numeric(10,7),
  lng         numeric(10,7),
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

INSERT INTO public.locations (name, slug, address)
VALUES ('Sturgeon Spirits Distillery', 'distillery', '123 Main St, Your Town');

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE public.profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Profiles: users see/edit only their own; staff/admin see all
CREATE POLICY "profiles: own read"   ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles: own update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles: staff read" ON public.profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('staff','admin')));

-- Locations: public read
CREATE POLICY "locations: public read" ON public.locations FOR SELECT USING (true);
