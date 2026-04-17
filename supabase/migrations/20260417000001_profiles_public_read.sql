-- Allow all authenticated users to read basic profile info (display_name, avatar_url)
-- needed for leaderboard standings to show player names.
-- This is a SELECT-only policy — users still can only UPDATE their own row.
CREATE POLICY "profiles: authenticated read display"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);
