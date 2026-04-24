-- ────────────────────────────────────────────────────────────
-- Toast 10x import report
-- Run in Supabase Studio → SQL Editor (or psql).
-- No mutations — read-only.
-- ────────────────────────────────────────────────────────────

-- 1. Headline totals
SELECT
  count(*)                                   AS toast_import_events,
  count(DISTINCT user_id)                    AS distinct_profiles_affected,
  sum(points_delta)                          AS total_app_points_granted,
  round(sum(points_delta) * 0.9)::int        AS would_reduce_by_at_1x
FROM earn_events
WHERE context_type = 'toast_import';

-- 2. Ratio distribution — parses "X Toast pts → Y app pts" out of the notes
--    column so we can confirm how many were actually 10x.
SELECT
  CASE
    WHEN (substring(notes FROM 'Toast loyalty link:\s*(\d+)')::int) = 0 THEN '0→0'
    ELSE
      round(
        (substring(notes FROM '→\s*(\d+)\s*app pts')::numeric)
        / nullif(substring(notes FROM 'Toast loyalty link:\s*(\d+)')::numeric, 0)
      , 2)::text
  END AS ratio_app_per_toast,
  count(*) AS events
FROM earn_events
WHERE context_type = 'toast_import'
GROUP BY 1
ORDER BY events DESC;

-- 3. Top 20 accounts by imported app-points, with current balance
SELECT
  COALESCE(p.display_name, p.full_name, p.email, ee.user_id::text) AS customer,
  count(*)                                                          AS import_events,
  sum(ee.points_delta)                                              AS total_granted,
  pl.balance                                                        AS current_balance
FROM earn_events ee
LEFT JOIN profiles p         ON p.id        = ee.user_id
LEFT JOIN points_ledger pl   ON pl.user_id  = ee.user_id
WHERE ee.context_type = 'toast_import'
GROUP BY p.display_name, p.full_name, p.email, ee.user_id, pl.balance
ORDER BY total_granted DESC
LIMIT 20;

-- 4. First/last import timestamps (so we know the window the bug was active)
SELECT min(created_at) AS first_import,
       max(created_at) AS last_import
FROM earn_events
WHERE context_type = 'toast_import';
