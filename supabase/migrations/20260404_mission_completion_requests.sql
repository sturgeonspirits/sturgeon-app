-- Migration: mission_completion_requests
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
--
-- Purpose: allows customers to request mission completion in-app so staff
-- can approve from a queue without needing to look up names.
--
-- This migration is idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS mission_completion_requests (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id  UUID        NOT NULL REFERENCES missions(id)   ON DELETE CASCADE,
  status      TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'rejected')),
  notes       TEXT,
  reviewed_by UUID        REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ
);

-- Prevent duplicate pending requests from the same user for the same mission
CREATE UNIQUE INDEX IF NOT EXISTS mission_completion_requests_pending_unique
  ON mission_completion_requests (user_id, mission_id)
  WHERE status = 'pending';

-- RLS
ALTER TABLE mission_completion_requests ENABLE ROW LEVEL SECURITY;

-- Drop & recreate policies so this migration is safely re-runnable
DROP POLICY IF EXISTS "Users insert own requests" ON mission_completion_requests;
DROP POLICY IF EXISTS "Users read own requests"   ON mission_completion_requests;

-- Customers can create their own requests
CREATE POLICY "Users insert own requests"
  ON mission_completion_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Customers can see their own requests
CREATE POLICY "Users read own requests"
  ON mission_completion_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Staff reads all via service client (bypasses RLS automatically)

-- Grant table access to Supabase roles. Without these, even the service_role
-- key gets "permission denied for table" because the table was created
-- outside the default Supabase grant path.
GRANT ALL        ON TABLE mission_completion_requests TO service_role;
GRANT SELECT, INSERT ON TABLE mission_completion_requests TO authenticated;
GRANT USAGE, SELECT  ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- Force PostgREST to reload its schema cache so the REST API picks up the table
NOTIFY pgrst, 'reload schema';
