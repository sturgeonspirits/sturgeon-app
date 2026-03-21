-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Cocktail recipes table + link to tasting journal
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.recipes (
  id              uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  name            text    NOT NULL,
  show_on_menu    boolean DEFAULT false,
  price           numeric(10,2),
  menu_section    text,
  tags            text[]  DEFAULT '{}',
  flavor_tags     text[]  DEFAULT '{}',
  sort_order      integer DEFAULT 999,
  -- Human-readable ingredient string (e.g. "oshgave, lime, triple sec")
  menu_ingredients text,
  -- Individual ingredients as an array (up to 10 from the spreadsheet)
  ingredients     text[]  DEFAULT '{}',
  instructions    text,
  photo_url       text,
  glassware       text,
  author          text,
  recipe_date     date,
  notes           text,
  is_event_menu   boolean DEFAULT false,
  grocery_override text,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.recipes OWNER TO postgres;

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_recipes_menu_section  ON public.recipes (menu_section);
CREATE INDEX IF NOT EXISTS idx_recipes_show_on_menu  ON public.recipes (show_on_menu) WHERE show_on_menu = true;
CREATE INDEX IF NOT EXISTS idx_recipes_sort_order    ON public.recipes (sort_order, name);

-- RLS: anyone can read active recipes; only service_role can write
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recipes are publicly readable"
  ON public.recipes FOR SELECT
  USING (is_active = true);

-- Link tasting_logs to recipes (nullable — members may log spirits OR cocktails)
ALTER TABLE public.tasting_logs
  ADD COLUMN IF NOT EXISTS recipe_id uuid REFERENCES public.recipes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasting_logs_recipe_id
  ON public.tasting_logs (recipe_id)
  WHERE recipe_id IS NOT NULL;

-- Helper: updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recipes_updated_at ON public.recipes;
CREATE TRIGGER recipes_updated_at
  BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
