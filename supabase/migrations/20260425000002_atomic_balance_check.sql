-- ─────────────────────────────────────────────
-- Changelog
--   v2026-04-25.1 — Audit P0-3: replace sync_points_ledger to RAISE on overdraft.
--                   Was silently clamping balance to 0, masking double-redemption races.
-- ─────────────────────────────────────────────
--
-- Behavior change:
--   Before: spending more than balance silently clamped to 0. Customer could
--           be charged for one redemption and effectively get the second free
--           because the trigger zeroed the deficit.
--   After:  any earn_event whose insert would take balance < 0 raises a
--           check_violation error (SQLSTATE 23514). The whole earn_event INSERT
--           rolls back. API callers should map this to a clean 409.
--
-- We also `SELECT … FOR UPDATE` the points_ledger row at the start of the
-- trigger so two concurrent inserts for the same user serialize. Combined with
-- the raise-on-overdraft, this closes the redemption-race window at the DB
-- layer regardless of what the API does.

CREATE OR REPLACE FUNCTION public.sync_points_ledger() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_current integer;
BEGIN
  -- Acquire the row lock first. If the row doesn't exist yet, treat current
  -- balance as 0; the INSERT path below will create it.
  SELECT balance INTO v_current
  FROM public.points_ledger
  WHERE user_id = NEW.user_id
  FOR UPDATE;

  IF v_current IS NULL THEN
    v_current := 0;
  END IF;

  -- Reject any negative delta that would push balance below zero.
  -- This is the heart of the fix: refuse silently-overdrafted spends.
  IF NEW.points_delta < 0 AND (v_current + NEW.points_delta) < 0 THEN
    RAISE EXCEPTION
      'Insufficient points balance: have %, attempted to deduct %',
      v_current, ABS(NEW.points_delta)
      USING ERRCODE = 'check_violation';
  END IF;

  -- Apply the delta. No more GREATEST(0, …) clamp — we've already validated.
  INSERT INTO public.points_ledger (
    user_id, balance, lifetime_earned, lifetime_spent, last_updated_at
  ) VALUES (
    NEW.user_id,
    GREATEST(0, NEW.points_delta),  -- only used on first insert; safe-by-construction since we'd have raised above
    CASE WHEN NEW.points_delta > 0 THEN NEW.points_delta ELSE 0 END,
    CASE WHEN NEW.points_delta < 0 THEN ABS(NEW.points_delta) ELSE 0 END,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    balance         = points_ledger.balance + NEW.points_delta,
    lifetime_earned = points_ledger.lifetime_earned + CASE WHEN NEW.points_delta > 0 THEN NEW.points_delta ELSE 0 END,
    lifetime_spent  = points_ledger.lifetime_spent  + CASE WHEN NEW.points_delta < 0 THEN ABS(NEW.points_delta) ELSE 0 END,
    last_updated_at = now();

  RETURN NEW;
END;
$$;

-- Trigger definition is unchanged (AFTER INSERT on earn_events) — replacing
-- the function alone is enough.

NOTIFY pgrst, 'reload schema';
