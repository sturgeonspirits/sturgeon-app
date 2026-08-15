-- ─────────────────────────────────────────────
-- Changelog
--   v2026-08-10.1 — Close profiles PII leak: drop the blanket authenticated
--                   SELECT policy, expose public_profiles view instead.
-- ─────────────────────────────────────────────
--
-- The problem
-- -----------
-- `20260417000001_profiles_public_read.sql` added:
--
--   CREATE POLICY "profiles: authenticated read display"
--     ON public.profiles FOR SELECT TO authenticated USING (true);
--
-- Its comment claimed it exposed "basic profile info (display_name,
-- avatar_url)". RLS is row-level, not column-level — the policy exposed the
-- ENTIRE row. Any logged-in member could open devtools and run
--
--   supabase.from('profiles').select('*')
--
-- against the anon key and receive every member's email, phone, birthday,
-- full_name, last_initial, preferred_name, role, pos_customer_id,
-- toast_customer_id, toast_spend_cents, toast_visits and toast_metadata.
--
-- The fix
-- -------
-- 1. Drop the policy. `profiles: own read` (self) and `profiles: staff read`
--    (via the SECURITY DEFINER is_staff helper) remain and are sufficient for
--    every legitimate direct read of the table.
-- 2. Add `public.public_profiles` — a four-column view that is the ONLY thing
--    a non-staff member can read about another member.
--
-- The view is intentionally left at the default `security_invoker = false`, so
-- it executes as its owner and is not blocked by the (now restrictive) RLS on
-- profiles. That is the whole point: the view IS the access-control boundary.
-- Supabase's linter flags definer views generically — this one is deliberate,
-- and it is safe because the view's column list cannot leak what it does not
-- select.
--
-- Idempotent — safe to re-run.

-- ── 1. Drop the over-broad policy ─────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles: authenticated read display" ON public.profiles;

-- ── 2. The public projection ──────────────────────────────────────────────────
-- display_name falls back to full_name because that is exactly what the
-- leaderboard UI already did client-side (`display_name ?? full_name`).
-- Doing the coalesce inside the view preserves the rendered output while
-- making full_name unselectable as a column.
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  p.id,
  COALESCE(NULLIF(btrim(p.display_name), ''), NULLIF(btrim(p.full_name), '')) AS display_name,
  p.avatar_url,
  p.tier
FROM public.profiles p;

ALTER VIEW public.public_profiles SET (security_barrier = true);

-- Owner must be able to read profiles for the definer-view to work.
ALTER VIEW public.public_profiles OWNER TO postgres;

-- ── 3. Grants ─────────────────────────────────────────────────────────────────
REVOKE ALL ON public.public_profiles FROM PUBLIC, anon;
GRANT SELECT ON public.public_profiles TO authenticated, service_role;

COMMENT ON VIEW public.public_profiles IS
  'Member-visible projection of profiles. The only member-to-member read path. '
  'Do not add columns here without deciding they are safe for every logged-in '
  'member to see — see migration 20260810000000.';

NOTIFY pgrst, 'reload schema';
