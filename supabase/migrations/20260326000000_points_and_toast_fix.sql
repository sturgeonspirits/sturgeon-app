-- ── 1. Update event_types placement_points to new scheme ──────────────────
-- Trivia / team events: 1st=65, 2nd=40, participant=15
UPDATE public.event_types
SET placement_points = '{"1": 65, "2": 40, "participant": 15}'::jsonb
WHERE participant_type = 'team';

-- Cribbage / wins_losses: win=10, loss=5
UPDATE public.event_types
SET placement_points = '{"win": 10, "loss": 5, "participant": 5}'::jsonb
WHERE scoring_method = 'wins_losses';

-- ── 2. Fix Toast import earn_events — divide all existing 10x imports by 10 ─
-- The original import script used 10:1 conversion (should have been 1:1).
-- Divide every toast_import earn_event's points_delta by 10.
UPDATE public.earn_events
SET points_delta = ROUND(points_delta / 10)
WHERE context_type = 'toast_import'
  AND points_delta > 0;

-- Mark those toast_loyalty_accounts as needing re-sync so the correct value
-- is reflected (points_imported stays true — we just corrected the amount).
-- No action needed on toast_loyalty_accounts; the earn_events correction is enough.

-- ── 3. Add trivia_period_join_token column for QR join flow ───────────────
ALTER TABLE public.leaderboard_periods
  ADD COLUMN IF NOT EXISTS join_token text UNIQUE;

-- Trigger to auto-generate a join token when a period is created
CREATE OR REPLACE FUNCTION public.generate_join_token()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.join_token IS NULL THEN
    NEW.join_token := encode(gen_random_bytes(6), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_join_token ON public.leaderboard_periods;
CREATE TRIGGER set_join_token
  BEFORE INSERT ON public.leaderboard_periods
  FOR EACH ROW EXECUTE FUNCTION public.generate_join_token();

-- Backfill existing periods that have no token
UPDATE public.leaderboard_periods
SET join_token = encode(gen_random_bytes(6), 'hex')
WHERE join_token IS NULL;
