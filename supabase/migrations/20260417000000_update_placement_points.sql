-- Update placement_points to new scheme:
-- - attend: points for showing up (any wins/losses or score recorded)
-- - 1st_bonus: extra points for 1st place
-- - 2nd_bonus: extra points for 2nd place
-- Attendance is awarded on score entry; placement bonuses on finalize.

-- Cribbage / wins_losses events
UPDATE public.event_types
SET placement_points = '{"attend": 15, "1st_bonus": 50, "2nd_bonus": 30}'::jsonb
WHERE scoring_method = 'wins_losses';

-- Trivia / team events
UPDATE public.event_types
SET placement_points = '{"attend": 15, "1st_bonus": 50, "2nd_bonus": 30}'::jsonb
WHERE participant_type = 'team';
