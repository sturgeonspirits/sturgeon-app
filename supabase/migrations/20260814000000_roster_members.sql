-- ─────────────────────────────────────────────
-- Changelog
--   v2026-08-14.1 — Roster members: name-only profiles with no auth user, for
--                   players (e.g. cribbage regulars) who have no email address.
--                   Record-only — they never earn points. Includes the claim
--                   function that merges a roster profile into a real account.
-- ─────────────────────────────────────────────
--
-- Why this works
-- --------------
-- public.profiles has NO foreign key to auth.users. A profile row can exist
-- with no login attached. That is what a "roster member" is: a real row in
-- profiles, visible in standings and pickable as a cribbage opponent, that
-- nobody can sign into.
--
-- The rules
-- ---------
--   1. is_roster = true  ⇒  no auth user, no email, full_name required.
--   2. Roster members NEVER earn points. Enforced in the API routes AND by the
--      trigger below, so an unguarded path fails loudly instead of quietly
--      accruing a balance nobody can spend.
--   3. When the person eventually signs up with a real email, staff call
--      claim_roster_profile() — their history moves to the real account and the
--      roster row is retired.
--
-- Idempotent — safe to re-run.

-- ── 1. Columns ───────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_roster         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS roster_note       text,
  ADD COLUMN IF NOT EXISTS roster_created_by uuid,
  ADD COLUMN IF NOT EXISTS roster_created_at timestamptz;

COMMENT ON COLUMN public.profiles.is_roster IS
  'True = name-only member with no auth user and no email. Cannot log in, '
  'cannot earn points. Retired via claim_roster_profile() when they sign up.';

-- A roster member must be nameable (they are only ever identified by name) and
-- must not carry an email (an email means they can have a real account).
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_roster_shape_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_roster_shape_check CHECK (
  NOT is_roster
  OR (full_name IS NOT NULL AND btrim(full_name) <> '' AND email IS NULL AND role = 'customer')
);

CREATE INDEX IF NOT EXISTS idx_profiles_is_roster
  ON public.profiles (is_roster) WHERE is_roster;

-- ── 2. Roster members cannot earn points ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.block_roster_earn_events()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.user_id AND is_roster) THEN
    RAISE EXCEPTION
      'Roster members cannot earn points (profile %). Claim them into a real account first.',
      NEW.user_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_roster_earn_events ON public.earn_events;
CREATE TRIGGER trg_block_roster_earn_events
  BEFORE INSERT ON public.earn_events
  FOR EACH ROW EXECUTE FUNCTION public.block_roster_earn_events();

-- ── 3. Claim audit trail ─────────────────────────────────────────────────────
-- The roster row is deleted on claim, so the audit lives here.
CREATE TABLE IF NOT EXISTS public.roster_claims (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  roster_profile_id uuid        NOT NULL,   -- deliberately not an FK: the row is gone
  roster_name       text        NOT NULL,
  claimed_by        uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  claimed_at        timestamptz NOT NULL DEFAULT now(),
  staff_id          uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  rows_moved        jsonb       NOT NULL DEFAULT '{}'
);

ALTER TABLE public.roster_claims ENABLE ROW LEVEL SECURITY;
-- Staff-only read; all writes go through claim_roster_profile().
DROP POLICY IF EXISTS "roster_claims: staff read" ON public.roster_claims;
CREATE POLICY "roster_claims: staff read"
  ON public.roster_claims FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('staff', 'admin')
  ));

-- ── 4. The claim ─────────────────────────────────────────────────────────────
-- Merges a roster profile FORWARD into a real account. Forward, not backward,
-- because RLS is written against `auth.uid() = profiles.id` — the surviving row
-- must be the one whose id equals the auth user's id.
--
-- Every FK that references profiles(id) is repointed, discovered from the
-- catalog rather than hard-coded, so tables added later are handled too.
-- Rows are moved one at a time: where a unique constraint means both profiles
-- already occupy the same slot (both played the same night), the real account's
-- row wins and the roster row is dropped.
CREATE OR REPLACE FUNCTION public.claim_roster_profile(
  p_roster_id uuid,
  p_target_id uuid,
  p_staff_id  uuid DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_roster  public.profiles%ROWTYPE;
  v_target  public.profiles%ROWTYPE;
  v_fk      record;
  v_ctids   tid[];
  v_ctid    tid;
  v_moved   int;
  v_dropped int;
  v_report  jsonb := '{}'::jsonb;
BEGIN
  IF p_roster_id = p_target_id THEN
    RAISE EXCEPTION 'Cannot claim a profile into itself';
  END IF;

  SELECT * INTO v_roster FROM public.profiles WHERE id = p_roster_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Roster profile % not found', p_roster_id;
  END IF;
  IF NOT v_roster.is_roster THEN
    RAISE EXCEPTION 'Profile % is not a roster member', p_roster_id;
  END IF;

  SELECT * INTO v_target FROM public.profiles WHERE id = p_target_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target profile % not found', p_target_id;
  END IF;
  IF v_target.is_roster THEN
    RAISE EXCEPTION 'Target profile % is itself a roster member — claim into a real account', p_target_id;
  END IF;

  FOR v_fk IN
    SELECT con.conrelid::regclass::text AS tbl, att.attname AS col
    FROM pg_constraint con
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
    WHERE con.contype  = 'f'
      AND con.confrelid = 'public.profiles'::regclass
      AND con.conrelid <> 'public.profiles'::regclass
      AND array_length(con.conkey, 1) = 1
    ORDER BY 1, 2
  LOOP
    v_moved   := 0;
    v_dropped := 0;

    -- Snapshot the row set first: UPDATE changes ctid, so iterating a live
    -- cursor over the same table would be unsafe.
    EXECUTE format('SELECT array_agg(ctid) FROM %s WHERE %I = $1', v_fk.tbl, v_fk.col)
      INTO v_ctids USING p_roster_id;

    IF v_ctids IS NOT NULL THEN
      FOREACH v_ctid IN ARRAY v_ctids LOOP
        BEGIN
          EXECUTE format('UPDATE %s SET %I = $1 WHERE ctid = $2', v_fk.tbl, v_fk.col)
            USING p_target_id, v_ctid;
          v_moved := v_moved + 1;
        EXCEPTION WHEN unique_violation THEN
          -- The real account already has a row in this slot; keep theirs.
          EXECUTE format('DELETE FROM %s WHERE ctid = $1', v_fk.tbl) USING v_ctid;
          v_dropped := v_dropped + 1;
        END;
      END LOOP;
    END IF;

    IF v_moved > 0 OR v_dropped > 0 THEN
      v_report := v_report || jsonb_build_object(
        v_fk.tbl || '.' || v_fk.col,
        jsonb_build_object('moved', v_moved, 'dropped', v_dropped)
      );
    END IF;
  END LOOP;

  -- A match the two profiles played against each other would now be a
  -- self-match. Drop those rather than leave nonsense in the standings.
  DELETE FROM public.cribbage_match_reports
    WHERE reporter_id = p_target_id AND opponent_id = p_target_id;

  -- Carry over anything the roster row knew that the real account does not.
  UPDATE public.profiles SET
    full_name = COALESCE(NULLIF(btrim(full_name), ''), v_roster.full_name),
    phone     = COALESCE(NULLIF(btrim(phone),     ''), v_roster.phone),
    birthday  = COALESCE(birthday, v_roster.birthday)
  WHERE id = p_target_id;

  INSERT INTO public.roster_claims
    (roster_profile_id, roster_name, claimed_by, staff_id, rows_moved)
  VALUES
    (p_roster_id, v_roster.full_name, p_target_id, p_staff_id, v_report);

  DELETE FROM public.profiles WHERE id = p_roster_id;

  RETURN jsonb_build_object(
    'ok',          true,
    'rosterName',  v_roster.full_name,
    'claimedBy',   p_target_id,
    'rowsMoved',   v_report
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_roster_profile(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_roster_profile(uuid, uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.claim_roster_profile(uuid, uuid, uuid) IS
  'Merge a name-only roster profile into a real signed-up account. Service-role '
  'only — call it from /api/staff/roster/claim, never from the client.';

NOTIFY pgrst, 'reload schema';
