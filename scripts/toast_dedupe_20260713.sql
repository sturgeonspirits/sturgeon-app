-- ─────────────────────────────────────────────
-- Changelog
--   v2026-07-13.1 — One-time cleanup for duplicates created by the 2026-07-13
--                   Toast sync. Root cause: PostgREST's 1,000-row response cap
--                   truncated the card-number fallback map, so 2,828 CSV rows
--                   were inserted as new instead of updating existing cards.
-- ─────────────────────────────────────────────
-- Run each step separately in the Supabase SQL editor, in order.
-- A duplicate pair = a row created 2026-07-13 sharing a card_number with an
-- older row. We keep the OLD row (original toast_card_id/account_id, profile
-- link, points_imported history), copy the fresh Toast data onto it, and
-- delete today's duplicate.

-- ── Step 1: Dry run — count duplicate pairs (expect roughly 2,400–2,600) ─────
SELECT count(*) AS duplicate_pairs
FROM toast_loyalty_accounts n
JOIN toast_loyalty_accounts o
  ON o.card_number = n.card_number AND o.id <> n.id
WHERE n.imported_at >= '2026-07-13'
  AND o.imported_at <  '2026-07-13';

-- ── Step 2: Merge fresh data into old rows, then delete the duplicates ───────
BEGIN;

UPDATE toast_loyalty_accounts o
SET toast_points   = n.toast_points,
    accrue_count   = n.accrue_count,
    redeem_count   = n.redeem_count,
    first_trans_at = coalesce(o.first_trans_at, n.first_trans_at),
    last_trans_at  = n.last_trans_at,
    email          = coalesce(n.email, o.email),
    phone          = coalesce(n.phone, o.phone),
    profile_id     = coalesce(o.profile_id, n.profile_id),
    updated_at     = now()
FROM toast_loyalty_accounts n
WHERE o.card_number = n.card_number
  AND o.id <> n.id
  AND o.imported_at <  '2026-07-13'
  AND n.imported_at >= '2026-07-13';

DELETE FROM toast_loyalty_accounts n
USING toast_loyalty_accounts o
WHERE o.card_number = n.card_number
  AND o.id <> n.id
  AND o.imported_at <  '2026-07-13'
  AND n.imported_at >= '2026-07-13';

COMMIT;

-- ── Step 3: Verify — both must return zero rows ──────────────────────────────
-- 3a. No card_number appears twice
SELECT card_number, count(*)
FROM toast_loyalty_accounts
WHERE card_number IS NOT NULL
GROUP BY card_number
HAVING count(*) > 1;

-- 3b. No profile linked to conflicting duplicate cards from today
SELECT profile_id, count(*)
FROM toast_loyalty_accounts
WHERE profile_id IS NOT NULL AND imported_at >= '2026-07-13'
GROUP BY profile_id
HAVING count(*) > 3;
