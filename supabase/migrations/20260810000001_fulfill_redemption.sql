-- ─────────────────────────────────────────────
-- Changelog
--   v2026-08-10.1 — Add fulfill_redemption(): atomic approve/reject for
--                   pending reward redemptions. Closes the free-reward window
--                   in POST /api/staff/redeem mode 1.
-- ─────────────────────────────────────────────
--
-- The problem
-- -----------
-- The route marked the redemption `redeemed` and THEN called emitEarnEvent,
-- with no transaction spanning the two. Since 20260425000002 the
-- sync_points_ledger trigger raises on overdraft, so with several pending
-- redemptions queued against one balance the second approval threw *after*
-- the status flip had already committed. The outer try/catch turned that into
-- a 500 and the row stayed `status = 'redeemed'` with no points deducted:
-- a free reward, one per queued redemption.
--
-- Second bug on the same lines: the UPDATE was keyed on `id` alone. The
-- earlier SELECT filtered on `status = 'pending'`, but nothing held that
-- between the read and the write, so two concurrent approvals of the same
-- redemption both passed the check and both deducted.
--
-- The fix
-- -------
-- One SECURITY DEFINER function, one transaction:
--
--   * `SELECT … FOR UPDATE` on the redemption row serializes concurrent
--     approvals of the same redemption — the loser sees status <> 'pending'
--     and returns ok=false instead of double-deducting.
--   * The earn_event INSERT happens BEFORE the status flip. If the
--     sync_points_ledger trigger raises on overdraft, the function aborts and
--     PostgreSQL rolls back the whole statement — including the status flip,
--     which has not happened yet anyway. There is no ordering in which the
--     reward is marked redeemed without the points coming out.
--   * The UPDATE still carries `AND status = 'pending'` as a belt-and-braces
--     guard alongside the row lock.
--
-- Returns jsonb rather than raising for the "not pending" case so the caller
-- can tell a benign double-click (404) apart from a real failure (500).
--
-- Third bug, found while testing this one: the Reject button has never worked.
-- The route wrote `status = 'rejected'`, but reward_redemptions_status_check
-- only allows pending / redeemed / expired / cancelled, so every rejection hit
-- a constraint violation → 500. RedemptionActions.tsx ignores the response and
-- calls router.refresh(), so staff saw the row quietly stay pending. This
-- function accepts 'rejected' as an input alias and stores 'cancelled'.
--
-- Idempotent — safe to re-run.

CREATE OR REPLACE FUNCTION public.fulfill_redemption(
  p_redemption_id uuid,
  p_staff_id      uuid,
  p_action        text DEFAULT 'redeemed'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rr       public.reward_redemptions%ROWTYPE;
  v_name     text;
  v_cost     integer;
  v_reward   uuid;
  v_event_id uuid;
  v_status   text;
BEGIN
  IF p_action NOT IN ('redeemed', 'rejected', 'cancelled') THEN
    RAISE EXCEPTION 'fulfill_redemption: invalid action %', p_action
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 'rejected' is the word the UI uses; 'cancelled' is the word the
  -- reward_redemptions_status_check constraint allows.
  v_status := CASE WHEN p_action = 'redeemed' THEN 'redeemed' ELSE 'cancelled' END;

  -- Lock the redemption. Concurrent callers queue here; the second one wakes
  -- up to status = 'redeemed' and bails out below.
  SELECT * INTO v_rr
  FROM public.reward_redemptions
  WHERE id = p_redemption_id
  FOR UPDATE;

  IF NOT FOUND OR v_rr.status <> 'pending' THEN
    RETURN jsonb_build_object(
      'ok',     false,
      'reason', 'not_pending',
      'status', COALESCE(v_rr.status, 'missing')
    );
  END IF;

  SELECT r.id, r.name, COALESCE(r.points_cost, 0)
    INTO v_reward, v_name, v_cost
  FROM public.rewards r
  WHERE r.id = v_rr.reward_id;

  v_cost := COALESCE(v_cost, 0);

  -- Deduct FIRST. On overdraft the trigger raises 23514 and the whole
  -- function rolls back, leaving the redemption pending.
  IF p_action = 'redeemed' AND v_cost > 0 THEN
    INSERT INTO public.earn_events (
      user_id, event_type, points_delta, context_type, context_id, notes
    ) VALUES (
      v_rr.user_id,
      'reward_redeemed'::public.earn_event_type,
      -v_cost,
      'reward',
      v_reward,
      'Redeemed: ' || COALESCE(v_name, 'reward')
    )
    RETURNING id INTO v_event_id;

    PERFORM public.recalculate_tier(v_rr.user_id);
  END IF;

  UPDATE public.reward_redemptions
  SET status        = v_status,
      redeemed_at   = CASE WHEN p_action = 'redeemed' THEN now() ELSE redeemed_at END,
      redeemed_by   = p_staff_id,
      earn_event_id = COALESCE(v_event_id, earn_event_id)
  WHERE id = p_redemption_id
    AND status = 'pending';

  RETURN jsonb_build_object(
    'ok',            true,
    'action',        v_status,
    'earn_event_id', v_event_id,
    'points_spent',  CASE WHEN p_action = 'redeemed' THEN v_cost ELSE 0 END
  );
END;
$$;

-- Staff routes call this with the service-role key after requireStaff().
-- No member-facing path should ever reach it.
REVOKE ALL ON FUNCTION public.fulfill_redemption(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_redemption(uuid, uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';
