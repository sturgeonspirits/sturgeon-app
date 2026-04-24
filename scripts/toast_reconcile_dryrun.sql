-- ────────────────────────────────────────────────────────────
-- Toast reconcile — DRY RUN (read-only)
-- Run in Supabase Studio → SQL Editor.
--
-- KEY DETAIL: Toast creates duplicate accounts when a customer uses a
-- gift card. Duplicates hold IDENTICAL point balances that move in
-- parallel. Every human has ONE real account — duplicates are phantoms.
--
-- So: target_toast_pts = MAX(toast_points) across linked cards, NOT SUM.
-- (MAX = any card's value since they move in lockstep; using MAX means
-- even if Toast's parallel-sync lags for a moment, we pick the latest.)
--
-- For each profile with at least one linked toast_loyalty_account:
--   target       = MAX(toast_points) across their linked, active Toast cards
--   imported     = SUM(points_delta)  of their prior toast_import earn_events
--   correction   = target - imported        (can be negative)
-- ────────────────────────────────────────────────────────────

WITH toast_by_profile AS (
  SELECT
    tla.profile_id,
    MAX(tla.toast_points)::int  AS target_toast_pts,
    COUNT(*)                     AS linked_cards,
    MIN(tla.toast_points)::int  AS min_card_pts,
    MAX(tla.toast_points)::int  AS max_card_pts
  FROM public.toast_loyalty_accounts tla
  WHERE tla.profile_id IS NOT NULL
    AND tla.is_deactivated = FALSE
  GROUP BY tla.profile_id
),
imported_by_profile AS (
  SELECT
    ee.user_id AS profile_id,
    COALESCE(SUM(ee.points_delta), 0)::int AS already_imported,
    COUNT(*)                                AS import_events
  FROM public.earn_events ee
  WHERE ee.context_type = 'toast_import'
  GROUP BY ee.user_id
),
combined AS (
  SELECT
    COALESCE(t.profile_id, i.profile_id)          AS profile_id,
    COALESCE(t.target_toast_pts, 0)               AS target_toast_pts,
    COALESCE(t.linked_cards, 0)                   AS linked_cards,
    COALESCE(t.min_card_pts, 0)                   AS min_card_pts,
    COALESCE(t.max_card_pts, 0)                   AS max_card_pts,
    COALESCE(i.already_imported, 0)               AS already_imported,
    COALESCE(i.import_events, 0)                  AS import_events,
    COALESCE(t.target_toast_pts, 0) - COALESCE(i.already_imported, 0) AS correction_delta
  FROM toast_by_profile t
  FULL OUTER JOIN imported_by_profile i ON t.profile_id = i.profile_id
)
SELECT
  COALESCE(p.display_name, p.full_name, p.email, c.profile_id::text) AS customer,
  p.email,
  c.linked_cards,
  -- Flag if duplicate cards ever got out of sync (should be 0 — sanity check)
  CASE WHEN c.linked_cards > 1 AND c.min_card_pts <> c.max_card_pts
       THEN 'DUPLICATES DIFFER: ' || c.min_card_pts || '..' || c.max_card_pts
       ELSE NULL END AS duplicate_drift,
  c.target_toast_pts,
  c.already_imported,
  c.correction_delta,
  pl.balance AS current_balance,
  (pl.balance + c.correction_delta) AS projected_balance_after_fix
FROM combined c
LEFT JOIN public.profiles       p  ON p.id       = c.profile_id
LEFT JOIN public.points_ledger  pl ON pl.user_id = c.profile_id
WHERE c.correction_delta <> 0
ORDER BY c.correction_delta ASC;

-- ── Summary ──────────────────────────────────────────────────
-- Run separately to see headline totals.
--
--   WITH toast_by_profile AS (
--     SELECT profile_id, MAX(toast_points)::int AS target_toast_pts
--     FROM public.toast_loyalty_accounts
--     WHERE profile_id IS NOT NULL AND is_deactivated = FALSE
--     GROUP BY profile_id
--   ),
--   imported_by_profile AS (
--     SELECT user_id AS profile_id, COALESCE(SUM(points_delta),0)::int AS already_imported
--     FROM public.earn_events WHERE context_type = 'toast_import'
--     GROUP BY user_id
--   )
--   SELECT
--     COUNT(*) FILTER (WHERE COALESCE(t.target_toast_pts,0) - COALESCE(i.already_imported,0) <> 0) AS profiles_to_correct,
--     SUM(COALESCE(t.target_toast_pts,0) - COALESCE(i.already_imported,0)) FILTER (WHERE COALESCE(t.target_toast_pts,0) - COALESCE(i.already_imported,0) < 0) AS total_negative_correction,
--     SUM(COALESCE(t.target_toast_pts,0) - COALESCE(i.already_imported,0)) FILTER (WHERE COALESCE(t.target_toast_pts,0) - COALESCE(i.already_imported,0) > 0) AS total_positive_correction
--   FROM toast_by_profile t
--   FULL OUTER JOIN imported_by_profile i ON t.profile_id = i.profile_id;
