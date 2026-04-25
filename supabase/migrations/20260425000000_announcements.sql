-- ─────────────────────────────────────────────
-- Changelog
--   v2026-04-25.1 — Add announcements table for staff-sent push broadcasts (manual sends only)
-- ─────────────────────────────────────────────

-- Records every push announcement staff sends to customers.
-- Manual sends only for now — no scheduled / automatic triggers write here.

CREATE TABLE IF NOT EXISTS public.announcements (
  id                uuid                     PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by           uuid                     REFERENCES auth.users(id) ON DELETE SET NULL,
  title             text                     NOT NULL,
  body              text                     NOT NULL,
  url               text                     NOT NULL DEFAULT '/',
  tag               text,
  -- Target descriptor. For now only 'all' is supported by the staff UI; the
  -- column is here so future targeting (event attendees, individual users)
  -- can be added without another migration. Shape: { "type": "all" }.
  target            jsonb                    NOT NULL DEFAULT '{"type":"all"}'::jsonb,
  subscriber_count  integer                  NOT NULL DEFAULT 0,
  sent_count        integer                  NOT NULL DEFAULT 0,
  failed_count      integer                  NOT NULL DEFAULT 0,
  expired_count     integer                  NOT NULL DEFAULT 0,
  created_at        timestamptz              NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS announcements_created_at_idx
  ON public.announcements (created_at DESC);

CREATE INDEX IF NOT EXISTS announcements_sent_by_idx
  ON public.announcements (sent_by);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Staff/admin can read history. Writes go through the service-role client
-- inside POST /api/staff/announcements, which bypasses RLS, so no insert
-- policy is required.
CREATE POLICY "announcements: staff read"
  ON public.announcements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('staff', 'admin')
    )
  );

COMMENT ON TABLE  public.announcements      IS 'Audit log of staff-sent push announcements. Manual sends only.';
COMMENT ON COLUMN public.announcements.target IS 'JSONB descriptor of who was targeted. Currently {"type":"all"}; reserved for future targeting modes.';
