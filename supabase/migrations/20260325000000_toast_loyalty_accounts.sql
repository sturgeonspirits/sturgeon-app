-- Toast loyalty accounts — imported from Toast POS RewardsCards export.
-- Stores raw Toast data and links to app profiles once matched by email/phone.

CREATE TABLE IF NOT EXISTS public.toast_loyalty_accounts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Toast identifiers
  toast_card_id     text UNIQUE NOT NULL,
  toast_account_id  text NOT NULL,
  card_number       text,
  is_classic_card   boolean DEFAULT false,
  is_deactivated    boolean DEFAULT false,

  -- Contact (from Toast export — may differ from app profile)
  email             text,
  phone             text,

  -- Loyalty state
  toast_points      integer DEFAULT 0,    -- current balance in Toast (1 pt = $1 spent)
  accrue_count      integer DEFAULT 0,
  redeem_count      integer DEFAULT 0,
  first_trans_at    timestamptz,
  last_trans_at     timestamptz,
  birthday          text,                 -- MM/DD as stored in Toast

  -- App link
  profile_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  points_imported   boolean DEFAULT false, -- true once earn_event has been created
  imported_at       timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

ALTER TABLE public.toast_loyalty_accounts ENABLE ROW LEVEL SECURITY;

-- Staff/service can read all; consumers can read their own
CREATE POLICY "service can manage toast accounts"
  ON public.toast_loyalty_accounts
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS toast_loyalty_accounts_email_idx   ON public.toast_loyalty_accounts (lower(email))    WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS toast_loyalty_accounts_phone_idx   ON public.toast_loyalty_accounts (phone)           WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS toast_loyalty_accounts_profile_idx ON public.toast_loyalty_accounts (profile_id)      WHERE profile_id IS NOT NULL;

GRANT ALL ON public.toast_loyalty_accounts TO service_role;
GRANT ALL ON public.toast_loyalty_accounts TO postgres;
GRANT ALL ON public.toast_loyalty_accounts TO authenticated;
