-- When a profile is created (or email/phone updated), automatically link
-- any matching unlinked Toast loyalty account and seed their points.
--
-- Matching order: email (exact, case-insensitive), then phone (normalised 10-digit).
-- Points are seeded via earn_events so the sync_points_ledger trigger fires.

CREATE OR REPLACE FUNCTION public.autolink_toast_loyalty()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_toast   public.toast_loyalty_accounts%ROWTYPE;
  v_app_pts integer;
BEGIN
  -- Skip staff/admin accounts
  IF NEW.role IN ('staff', 'admin') THEN
    RETURN NEW;
  END IF;

  -- Try to find an unlinked Toast account matching this profile
  SELECT * INTO v_toast
  FROM public.toast_loyalty_accounts
  WHERE profile_id IS NULL
    AND is_deactivated = FALSE
    AND (
      (NEW.email IS NOT NULL AND lower(email) = lower(NEW.email))
      OR
      (NEW.phone IS NOT NULL AND regexp_replace(phone, '\D', '', 'g') =
                                 regexp_replace(NEW.phone, '\D', '', 'g'))
    )
  ORDER BY toast_points DESC   -- prefer the account with the most points
  LIMIT 1;

  IF v_toast.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Link the Toast account to this profile
  UPDATE public.toast_loyalty_accounts
  SET profile_id = NEW.id, updated_at = now()
  WHERE id = v_toast.id;

  -- Set pos_customer_id on the profile
  UPDATE public.profiles
  SET pos_customer_id = v_toast.toast_account_id
  WHERE id = NEW.id;

  -- Seed points if not already imported
  IF NOT v_toast.points_imported AND v_toast.toast_points > 0 THEN
    v_app_pts := v_toast.toast_points * 10;  -- 1 Toast pt = $1 = 10 app pts

    INSERT INTO public.earn_events
      (user_id, event_type, points_delta, context_type, context_id, notes)
    VALUES
      (NEW.id, 'purchase_recorded', v_app_pts,
       'toast_import', v_toast.id::text,
       'Toast loyalty import: ' || v_toast.toast_points || ' Toast pts → ' || v_app_pts || ' app pts');

    UPDATE public.toast_loyalty_accounts
    SET points_imported = true, updated_at = now()
    WHERE id = v_toast.id;
  END IF;

  -- Backfill birthday if profile has none and Toast has one
  IF NEW.birthday IS NULL AND v_toast.birthday IS NOT NULL THEN
    UPDATE public.profiles
    SET birthday = v_toast.birthday
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Fire on INSERT (new sign-up) and on UPDATE of email/phone (profile edit)
DROP TRIGGER IF EXISTS toast_autolink_on_profile ON public.profiles;
CREATE TRIGGER toast_autolink_on_profile
  AFTER INSERT OR UPDATE OF email, phone
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.autolink_toast_loyalty();
