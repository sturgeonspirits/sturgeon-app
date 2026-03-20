-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Extend profiles with user info + toast loyalty placeholder
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add user info columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name      text,
  ADD COLUMN IF NOT EXISTS preferred_name text,
  ADD COLUMN IF NOT EXISTS last_initial   text,
  -- Toast POS loyalty placeholder columns (Phase 2)
  ADD COLUMN IF NOT EXISTS toast_customer_id  text,
  ADD COLUMN IF NOT EXISTS toast_visits       integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS toast_spend_cents  integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS toast_tier         text,
  ADD COLUMN IF NOT EXISTS toast_metadata     jsonb   DEFAULT '{}';

-- 2. Mark profile as needing onboarding if full_name is missing
-- (no extra column needed — we just check full_name IS NULL in the app)

-- 3. Update the handle_new_user trigger to capture metadata if provided
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    phone,
    display_name,
    full_name,
    preferred_name
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone'),
    -- display_name falls back: preferred_name → full_name first word → email prefix
    COALESCE(
      NEW.raw_user_meta_data->>'preferred_name',
      split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 1),
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'preferred_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 4. Backfill existing users: set display_name from email prefix if still null
UPDATE public.profiles
  SET display_name = split_part(email, '@', 1)
  WHERE display_name IS NULL AND email IS NOT NULL;

-- 5. Add an index for toast_customer_id lookups (Phase 2 POS sync)
CREATE INDEX IF NOT EXISTS idx_profiles_toast_customer_id
  ON public.profiles (toast_customer_id)
  WHERE toast_customer_id IS NOT NULL;

-- 6. Update RLS: users can update their own profile info
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
