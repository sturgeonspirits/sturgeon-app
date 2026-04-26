-- ─────────────────────────────────────────────
-- Changelog
--   v2026-04-25.1 — Make event-related missions repeatable so they stay
--                   active in the customer's mission grid after each completion.
-- ─────────────────────────────────────────────
--
-- Affected missions (matched by title, case-insensitive):
--   "Attend an event"
--   "Bring a friend"
--   "Win an event"

UPDATE public.missions
SET is_repeatable = true
WHERE is_repeatable = false
  AND (
       title ILIKE '%attend%event%'
    OR title ILIKE '%bring%friend%'
    OR title ILIKE '%win%event%'
  );

NOTIFY pgrst, 'reload schema';
