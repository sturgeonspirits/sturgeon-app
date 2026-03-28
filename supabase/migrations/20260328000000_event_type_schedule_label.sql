-- Add optional schedule_label to event_types.
-- When set, this overrides the auto-generated "Wednesdays · 7:00 PM" label
-- and lets you express patterns like "1st & 3rd Wednesdays".

ALTER TABLE public.event_types
  ADD COLUMN IF NOT EXISTS schedule_label text;
