-- ────────────────────────────────────────────────────────────
-- Toast reconcile — WRITE (apply)
-- Run ONCE in Supabase Studio → SQL Editor after reviewing the dry-run.
--
-- Semantics: for each profile, align the sum of their toast_import
-- earn_events to MAX(toast_points) across their linked active Toast cards.
-- (Toast creates duplicate accounts for gift-card users with parallel
-- point balances — MAX picks the canonical one; SUM would triple-count.)
--
-- Inserts ONE corrective earn_event per affected profile; the
-- sync_points_ledger trigger auto-updates the ledger. Leaves App-awarded
-- points (any non-'toast_import' context_type) completely alone.
--
-- Safe to re-run: after it completes, all correction_deltas become 0.
--
-- ⚠️  Make sure no Toast CSV import is in progress when you run this.
-- ⚠️  Run the dry-run query first and sanity-check the top rows.
-- ────────────────────────────────────────────────────────────

BEGIN;

WITH toast_by_profile AS (
  SELECT
    tla.profile_id,
    MAX(tla.toast_points)::int AS target_toast_pts
  FROM public.toast_loyalty_accounts tla
  WHERE tla.profile_id IS NOT NULL
    AND tla.is_deactivated = FALSE
  GROUP BY tla.profile_id
),
imported_by_profile AS (
  SELECT
    ee.user_id AS profile_id,
    COALESCE(SUM(ee.points_delta), 0)::int AS already_imported
  FROM public.earn_events ee
  WHERE ee.context_type = 'toast_import'
  GROUP BY ee.user_id
),
corrections AS (
  SELECT
    COALESCE(t.profile_id, i.profile_id)                                    AS profile_id,
    COALESCE(t.target_toast_pts, 0)                                         AS target_toast_pts,
    COALESCE(i.already_imported, 0)                                         AS already_imported,
    COALESCE(t.target_toast_pts, 0) - COALESCE(i.already_imported, 0)       AS correction_delta
  FROM toast_by_profile t
  FULL OUTER JOIN imported_by_profile i ON t.profile_id = i.profile_id
)
INSERT INTO public.earn_events
  (user_id, event_type, points_delta, context_type, context_id, notes)
SELECT
  c.profile_id,
  'purchase_recorded'::public.earn_event_type,   -- same event_type existing toast_import events use
  c.correction_delta,                             -- negative values are fine; ledger sums regardless
  'toast_import',
  NULL,
  'Toast reconcile: reset to current Toast balance ('
    || c.target_toast_pts || ' Toast pts; was ' || c.already_imported
    || ', delta ' || c.correction_delta || ')'
FROM corrections c
WHERE c.correction_delta <> 0;

-- Read back: verify all corrections are now zero.
-- If ANY rows come back, change COMMIT to ROLLBACK.
WITH toast_by_profile AS (
  SELECT profile_id, MAX(toast_points)::int AS target_toast_pts
  FROM public.toast_loyalty_accounts
  WHERE profile_id IS NOT NULL AND is_deactivated = FALSE
  GROUP BY profile_id
),
imported_by_profile AS (
  SELECT user_id AS profile_id, COALESCE(SUM(points_delta),0)::int AS already_imported
  FROM public.earn_events WHERE context_type = 'toast_import'
  GROUP BY user_id
)
SELECT
  COALESCE(t.profile_id, i.profile_id) AS profile_id,
  COALESCE(t.target_toast_pts, 0)      AS target_toast_pts,
  COALESCE(i.already_imported, 0)      AS already_imported,
  COALESCE(t.target_toast_pts, 0) - COALESCE(i.already_imported, 0) AS remaining_delta
FROM toast_by_profile t
FULL OUTER JOIN imported_by_profile i ON t.profile_id = i.profile_id
WHERE COALESCE(t.target_toast_pts, 0) - COALESCE(i.already_imported, 0) <> 0;

-- If read-back returned ZERO rows, commit:
COMMIT;

-- If anything looked wrong, run instead:
-- ROLLBACK;
