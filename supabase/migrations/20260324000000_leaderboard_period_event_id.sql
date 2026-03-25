-- Link leaderboard_periods to a specific events row so scores can be
-- tracked per event date (e.g. "Karl: 3W on Thu March 26").
ALTER TABLE public.leaderboard_periods
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE SET NULL;

-- Index for fast lookup: "which period belongs to this event?"
CREATE INDEX IF NOT EXISTS leaderboard_periods_event_id_idx
  ON public.leaderboard_periods (event_id);
