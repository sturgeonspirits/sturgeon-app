-- Fix Toast import multiplier bug: points were imported at 10x instead of 1:1.
--
-- What happened:
--   The import code used `toast_points * 10` instead of `* 1`.
--   e.g. 1700 Toast pts were imported as 17000 app pts.
--
-- This migration corrects existing earn_events rows that were over-imported.
-- It divides each toast_import earn_event's points_delta by 10, then
-- recalculates each affected user's points_ledger.
--
-- ⚠️  Run this ONCE in the Supabase SQL editor after deploying the fixed code.
-- ⚠️  Make sure no Toast import is in progress when you run this.
-- ⚠️  This assumes ALL toast_import earn_events used the *10 multiplier.
--     If any legitimate 1:1 imports exist already, adjust the WHERE clause.

BEGIN;

-- Step 1: Correct the earn_events rows
UPDATE public.earn_events
SET
  points_delta = ROUND(points_delta / 10.0)::int,
  notes        = notes || ' [corrected: was 10x, now 1:1]'
WHERE
  context_type = 'toast_import'
  AND points_delta > 0;

-- Step 2: Rebuild points_ledger from scratch for affected users.
--         The ledger should be the sum of all earn_events for each user.
UPDATE public.points_ledger pl
SET
  balance         = agg.total,
  lifetime_earned = agg.earned
FROM (
  SELECT
    user_id,
    COALESCE(SUM(points_delta), 0)                               AS total,
    COALESCE(SUM(CASE WHEN points_delta > 0 THEN points_delta ELSE 0 END), 0) AS earned
  FROM public.earn_events
  GROUP BY user_id
) agg
WHERE pl.user_id = agg.user_id
  AND pl.user_id IN (
    SELECT DISTINCT user_id FROM public.earn_events WHERE context_type = 'toast_import'
  );

-- Step 3: Recalculate tiers for affected users
-- (Only needed if you have a recalculate_tier function; skip if not)
-- SELECT recalculate_tier(user_id)
-- FROM (SELECT DISTINCT user_id FROM earn_events WHERE context_type = 'toast_import') t;

COMMIT;
