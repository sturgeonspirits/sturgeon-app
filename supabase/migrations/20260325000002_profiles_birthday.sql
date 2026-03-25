-- Add birthday (MM/DD) to profiles — seeded from Toast loyalty import.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birthday text;  -- stored as 'MM/DD', e.g. '11/09'
