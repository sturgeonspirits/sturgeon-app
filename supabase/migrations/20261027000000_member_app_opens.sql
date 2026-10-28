-- ─────────────────────────────────────────────
-- Changelog
--   v2026-10-27.1 — App usage tracking: member_app_opens daily log,
--                   record_app_open() (called from middleware once per day),
--                   member_last_seen() for the staff dashboard. Seeds each
--                   member's last-seen day so the log isn't empty on day one.
-- ─────────────────────────────────────────────
--
-- Why
-- ---
-- The staff dashboard's "Active" numbers count members who EARNED points, not
-- members who opened the app. This adds a first-party record of opens:
--
--   * member_app_opens: one row per member per day (America/Chicago) they
--     opened the app. Nothing else is stored: no pages, devices or IPs.
--   * record_app_open(): called by middleware for the signed-in user, guarded
--     by a once-a-day cookie, so it's at most one insert per member per day
--     per device. ON CONFLICT DO NOTHING makes repeats harmless.
--   * member_last_seen(): latest of last sign-in and last session refresh from
--     auth.*, which already exists for every member. Gives accurate 7/30/90-day
--     counts from today, before the daily log has history.
--
-- Safe to run more than once.

-- ── 1. Daily open log ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.member_app_opens (
  user_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  opened_on date NOT NULL,
  PRIMARY KEY (user_id, opened_on)
);

CREATE INDEX IF NOT EXISTS member_app_opens_opened_on_idx
  ON public.member_app_opens (opened_on);

-- No policies: only the service role (staff dashboard) reads it, and members
-- write through record_app_open() below, never directly.
ALTER TABLE public.member_app_opens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.member_app_opens FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_app_opens TO service_role;

-- ── 2. Record an open for the signed-in member ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_app_open()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.member_app_opens (user_id, opened_on)
  SELECT p.id, (now() AT TIME ZONE 'America/Chicago')::date
  FROM public.profiles p
  WHERE p.id = auth.uid()
  ON CONFLICT DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.record_app_open() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_app_open() TO authenticated, service_role;

-- ── 3. Last seen per member (staff dashboard only) ─────────────────────────────
-- Customers only; roster members have no login and staff are left out.
-- Session refresh happens whenever someone opens the app after ~1 hour away,
-- so it tracks real use. Sessions are deleted on sign-out or expiry, in which
-- case last_sign_in_at is the fallback.
CREATE OR REPLACE FUNCTION public.member_last_seen()
RETURNS TABLE (user_id uuid, joined_at timestamptz, last_seen timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT p.id,
         p.created_at,
         greatest(
           u.last_sign_in_at,
           (SELECT max(greatest(s.refreshed_at, s.updated_at))
              FROM auth.sessions s WHERE s.user_id = u.id),
           (SELECT max(rt.updated_at)
              FROM auth.refresh_tokens rt WHERE rt.user_id::uuid = u.id)
         )
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.role = 'customer';
$$;

REVOKE ALL ON FUNCTION public.member_last_seen() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_last_seen() TO service_role;

-- ── 4. Seed: each member's last-seen day counts as one open ────────────────────
INSERT INTO public.member_app_opens (user_id, opened_on)
SELECT user_id, (last_seen AT TIME ZONE 'America/Chicago')::date
FROM public.member_last_seen()
WHERE last_seen IS NOT NULL
ON CONFLICT DO NOTHING;

-- Verify after applying:
--   SELECT count(*) FROM public.member_last_seen();          -- ≈ 60
--   SELECT count(*) FROM public.member_app_opens;            -- ≈ 60 after seed
--   SELECT has_function_privilege('authenticated', 'public.member_last_seen()', 'EXECUTE');  -- false
