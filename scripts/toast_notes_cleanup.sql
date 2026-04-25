-- ────────────────────────────────────────────────────────────
-- Toast notes cleanup
-- Rewrites confusing earn_events.notes left over from the 10x era
-- (the numbers in points_delta were already corrected; only the
-- human-readable string was left stale).
-- Run in Supabase Studio → SQL Editor.
-- ────────────────────────────────────────────────────────────

-- ── PART 1: Preview (read-only) ──────────────────────────────
-- How many rows fall into each pattern?

SELECT
  CASE
    WHEN notes LIKE '%→%app pts%'                  THEN 'has_arrow_old_10x_style'
    WHEN notes LIKE '% [corrected: was 10x, now 1:1]%' THEN 'has_stale_corrected_tag'
    WHEN notes LIKE 'Toast reconcile:%'             THEN 'new_reconcile_event'
    WHEN notes LIKE 'Toast sync:%'                  THEN 'new_sync_event'
    WHEN notes LIKE 'Toast redemption:%'            THEN 'new_redemption_event'
    WHEN notes LIKE 'Toast loyalty link:%'          THEN 'new_link_event'
    WHEN notes LIKE 'Toast loyalty import:%'        THEN 'trigger_import_event'
    WHEN notes LIKE 'Toast import:%'                THEN 'csv_sync_event'
    ELSE 'other'
  END AS pattern,
  COUNT(*) AS events,
  SUM(points_delta) AS total_pts
FROM public.earn_events
WHERE context_type = 'toast_import'
GROUP BY 1
ORDER BY events DESC;

-- ── PART 2: Sample (read-only) ───────────────────────────────
-- Show 10 examples of each pattern so you can see exactly what the
-- cleanup will do.

(SELECT 'WILL REWRITE (arrow style)' AS category, points_delta, notes
 FROM public.earn_events
 WHERE context_type = 'toast_import' AND notes LIKE '%→%app pts%'
 LIMIT 10)
UNION ALL
(SELECT 'WILL STRIP TAG (no arrow)' AS category, points_delta, notes
 FROM public.earn_events
 WHERE context_type = 'toast_import'
   AND notes LIKE '% [corrected: was 10x, now 1:1]%'
   AND notes NOT LIKE '%→%'
 LIMIT 10);

-- ── PART 3: Apply (write) ────────────────────────────────────
-- Run this block separately, AFTER reviewing parts 1 and 2.
-- It's wrapped in a transaction so you can ROLLBACK if needed.
--
--   BEGIN;
--
--   UPDATE public.earn_events
--   SET notes = CASE
--     -- Old 10x-era notes with the arrow → rewrite to match the CORRECTED delta,
--     -- using the same format the DB trigger emits: "Toast loyalty import: N Toast pts".
--     -- Since toast_import events are 1:1, Toast pts == app pts.
--     WHEN notes LIKE '%→%app pts%' THEN
--       'Toast loyalty import: ' || points_delta || ' Toast pts'
--     -- Notes that only carry the stale "[corrected: was 10x, now 1:1]" tag → strip it.
--     -- (Also strip any redundant "(corrected 1:1)" fragment if present.)
--     WHEN notes LIKE '% [corrected: was 10x, now 1:1]%' THEN
--       replace(
--         replace(notes, ' [corrected: was 10x, now 1:1]', ''),
--         ' (corrected 1:1)', ''
--       )
--     ELSE notes
--   END
--   WHERE context_type = 'toast_import'
--     AND (notes LIKE '%→%app pts%'
--          OR notes LIKE '% [corrected: was 10x, now 1:1]%');
--
--   -- Verify: this should return 0.
--   SELECT COUNT(*)
--   FROM public.earn_events
--   WHERE context_type = 'toast_import'
--     AND (notes LIKE '%→%app pts%'
--          OR notes LIKE '% [corrected: was 10x, now 1:1]%');
--
--   -- If 0, commit:
--   COMMIT;
--   -- If anything looks wrong: ROLLBACK;
