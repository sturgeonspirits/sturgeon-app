-- Migration: close birthday cocktail race condition
--
-- Two simultaneous check-ins on a customer's birthday could both pass the
-- "not already claimed this year" read-before-write check and insert two
-- redemption rows. This unique partial index makes the database itself reject
-- the second insert, so the try/catch in checkin/route.ts catches it cleanly.
--
-- The index covers: one birthday redemption per (user, reward) per calendar
-- year (evaluated in America/Chicago time, matching the rest of the app).

CREATE UNIQUE INDEX IF NOT EXISTS reward_redemptions_birthday_per_year
  ON reward_redemptions (
    user_id,
    reward_id,
    ( DATE_PART('year', created_at AT TIME ZONE 'America/Chicago') )::int
  )
  WHERE notes ILIKE '%birthday%';
