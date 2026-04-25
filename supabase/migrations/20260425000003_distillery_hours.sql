-- ─────────────────────────────────────────────
-- Changelog
--   v2026-04-25.1 — New table for tasting-room (and future Bar on Ice) hours.
--                   Synced from Google Sheets via /api/sync-menu (Hours tab).
-- ─────────────────────────────────────────────
--
-- Schema notes:
--   - One row is either a weekly schedule entry (day_of_week set) OR a
--     date-specific override (override_date set). Never both.
--   - Override rows take precedence over weekly rows for that calendar date.
--   - close_time can be earlier than open_time when hours cross midnight
--     (e.g., Friday 9 PM - 2 AM). The closes_next_day flag captures that
--     so the open-now logic can compare against tomorrow's date for the
--     close boundary.
--   - is_primary marks the location to feature first on the /club page.
--     Useful when there are multiple locations and you want one front-and-
--     centre. Defaults true for the first inserted location per slug.

CREATE TABLE IF NOT EXISTS public.distillery_hours (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location        text NOT NULL,                  -- "Tasting Room", "Bar on Ice", etc.
  day_of_week     smallint,                       -- 0=Sun … 6=Sat
  override_date   date,                           -- specific calendar date (overrides weekly)
  is_closed       boolean NOT NULL DEFAULT false,
  open_time       time,                           -- null when closed
  close_time      time,                           -- null when closed
  closes_next_day boolean NOT NULL DEFAULT false, -- true when close_time is "tomorrow"
  note            text,
  is_primary      boolean NOT NULL DEFAULT false,
  sort_order      integer NOT NULL DEFAULT 0,
  raw_hours_text  text,                           -- preserves the original sheet cell for audit
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT distillery_hours_dow_or_date
    CHECK ((day_of_week IS NOT NULL) <> (override_date IS NOT NULL)),
  CONSTRAINT distillery_hours_dow_range
    CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6))
);

-- One weekly row per (location, day_of_week)
CREATE UNIQUE INDEX IF NOT EXISTS distillery_hours_location_dow_uniq
  ON public.distillery_hours (location, day_of_week)
  WHERE day_of_week IS NOT NULL;

-- One override row per (location, date)
CREATE UNIQUE INDEX IF NOT EXISTS distillery_hours_location_date_uniq
  ON public.distillery_hours (location, override_date)
  WHERE override_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS distillery_hours_location_idx
  ON public.distillery_hours (location);

-- Auto-update updated_at on UPDATE
DROP TRIGGER IF EXISTS distillery_hours_updated_at ON public.distillery_hours;
CREATE TRIGGER distillery_hours_updated_at
  BEFORE UPDATE ON public.distillery_hours
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: public read, service-role write
ALTER TABLE public.distillery_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "distillery_hours: public read" ON public.distillery_hours;
CREATE POLICY "distillery_hours: public read"
  ON public.distillery_hours FOR SELECT
  USING (true);

GRANT SELECT ON public.distillery_hours TO anon, authenticated;
GRANT ALL    ON public.distillery_hours TO service_role;

NOTIFY pgrst, 'reload schema';
