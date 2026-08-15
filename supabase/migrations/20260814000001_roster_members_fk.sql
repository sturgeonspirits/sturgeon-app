-- ─────────────────────────────────────────────
-- Changelog
--   v2026-08-14.2 — Fix: 20260814000000 assumed profiles had no FK to
--                   auth.users. It does — profiles_id_fkey, ON DELETE CASCADE
--                   — so inserting a roster member (no auth user) failed with
--                   "violates foreign key constraint profiles_id_fkey".
--                   Replace the constraint with two triggers that keep both of
--                   its guarantees while allowing roster rows through.
-- ─────────────────────────────────────────────
--
-- What profiles_id_fkey guaranteed, and how each guarantee survives:
--
--   1. Every profile has a matching auth.users row.
--      → Now enforced by profiles_require_auth_user(), which applies the same
--        rule to every profile EXCEPT roster members. A roster member is
--        exactly "a member with no login", so this is the one row type that
--        must be exempt.
--
--   2. Deleting an auth user deletes its profile (ON DELETE CASCADE).
--      → Now enforced by delete_profile_for_deleted_user() on auth.users.
--        Roster members are unaffected: no auth user, nothing to cascade from.
--
-- A conditional foreign key is not expressible in Postgres, which is why this
-- has to become trigger logic rather than a narrower constraint.
--
-- Idempotent — safe to re-run.

-- ── 1. Drop the constraint ───────────────────────────────────────────────────
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- ── 2. Guarantee 1: non-roster profiles must have an auth user ───────────────
CREATE OR REPLACE FUNCTION public.profiles_require_auth_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NOT COALESCE(NEW.is_roster, false)
     AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = NEW.id) THEN
    RAISE EXCEPTION
      'Profile % has no auth user. Only roster members (is_roster = true) may exist without a login.',
      NEW.id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_require_auth_user ON public.profiles;
CREATE TRIGGER trg_profiles_require_auth_user
  BEFORE INSERT OR UPDATE OF id, is_roster ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_require_auth_user();

-- ── 3. Guarantee 2: deleting an auth user deletes its profile ────────────────
CREATE OR REPLACE FUNCTION public.delete_profile_for_deleted_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.profiles WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_delete_profile_for_deleted_user ON auth.users;
CREATE TRIGGER trg_delete_profile_for_deleted_user
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.delete_profile_for_deleted_user();

NOTIFY pgrst, 'reload schema';
