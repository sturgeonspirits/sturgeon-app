-- Add earn_event_type values that were added to types.ts but never applied to the DB.
-- bar_checkin: daily QR check-in at the bar
-- journal_entry_removed: points reversal when a tasting log is deleted

ALTER TYPE "public"."earn_event_type" ADD VALUE IF NOT EXISTS 'bar_checkin';
ALTER TYPE "public"."earn_event_type" ADD VALUE IF NOT EXISTS 'journal_entry_removed';
