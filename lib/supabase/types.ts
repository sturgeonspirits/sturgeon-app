// ─────────────────────────────────────────────
// Changelog
//   v2026-04-25.1 — Add 'journal_entry_removed' to EarnEventType union
//                   (was already in the DB enum via 20260403000000; this just
//                   un-breaks tsc on app/api/journal-entry/route.ts).
// ─────────────────────────────────────────────

// Run `npm run db:types` to regenerate from your live Supabase schema.
// This file is the manual baseline — keep in sync with migrations.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type EarnEventType =
  | 'mission_completed'
  | 'journal_entry'
  | 'journal_entry_removed'
  | 'leaderboard_awarded'
  | 'reward_redeemed'
  | 'tier_unlocked'
  | 'badge_awarded'
  | 'staff_adjustment'
  | 'purchase_recorded'
  | 'bar_checkin'

export type CompletionTrigger =
  | 'qr_scan'
  | 'manual_staff'
  | 'journal_entry'
  | 'toast_purchase'
  | 'event_attendance'
  | 'challenge_completion'

export type UserRole = 'customer' | 'staff' | 'admin'
export type UserTier = 'newcomer' | 'regular' | 'spearer' | 'harpooner' | 'captain'
export type RedemptionMethod = 'points' | 'leaderboard' | 'milestone' | 'streak' | 'tier_unlock' | 'staff_grant'
export type ParticipantType = 'individual' | 'team' | 'both'
export type ScoringMethod = 'wins_losses' | 'points' | 'placement' | 'time'

// ─── Row types ─────────────────────────────────────────────

export interface Profile {
  id: string
  email: string | null
  phone: string | null
  display_name: string | null
  avatar_url: string | null
  role: UserRole
  tier: UserTier
  pos_customer_id: string | null
  created_at: string
  updated_at: string
}

export interface PointsLedger {
  user_id: string
  balance: number
  lifetime_earned: number
  lifetime_spent: number
  last_updated_at: string
}

export interface TierThreshold {
  tier: UserTier
  min_lifetime: number
  label: string
  color: string
  perks: string[]
}

export interface EarnEvent {
  id: string
  user_id: string
  event_type: EarnEventType
  points_delta: number
  context_type: string | null
  context_id: string | null
  location_id: string | null
  notes: string | null
  created_at: string
}

export interface Mission {
  id: string
  slug: string
  title: string
  description: string | null
  icon: string
  points: number
  completion_trigger: CompletionTrigger
  is_repeatable: boolean
  repeat_limit: number | null
  repeat_cooldown_days: number | null
  min_tier: string
  is_active: boolean
  sort_order: number
  metadata: Json
  created_at: string
}

export interface MissionCompletion {
  id: string
  user_id: string
  mission_id: string
  earn_event_id: string | null
  completed_at: string
  completed_by: string | null
  notes: string | null
}

export interface Challenge {
  id: string
  slug: string
  title: string
  description: string | null
  icon: string
  bonus_points: number
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  sort_order: number
  metadata: Json
  created_at: string
}

export interface EventType {
  id: string
  name: string
  slug: string
  description: string | null
  participant_type: ParticipantType
  scoring_method: ScoringMethod
  participation_mission_slug: string | null
  win_mission_slug: string | null
  placement_points: Json
  icon: string
  color: string
  day_of_week: number | null
  typical_time: string | null
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface LeaderboardPeriod {
  id: string
  event_type_id: string
  label: string
  period_type: 'single_night' | 'weekly' | 'monthly' | 'season' | 'all_time'
  starts_at: string
  ends_at: string | null
  is_finalized: boolean
  created_at: string
}

export interface LeaderboardEvent {
  id: string
  period_id: string
  user_id: string
  score: number
  wins: number
  losses: number
  placement: number | null
  earn_event_id: string | null
  entered_by: string | null
  entered_at: string
  notes: string | null
}

export interface LeaderboardTeam {
  id: string
  period_id: string
  name: string
  score: number
  placement: number | null
  created_at: string
}

export interface Reward {
  id: string
  name: string
  description: string | null
  icon: string
  redemption_method: RedemptionMethod
  points_cost: number
  trigger_params: Json
  reward_type: string
  reward_value: string | null
  is_active: boolean
  max_per_user: number | null
  total_supply: number | null
  redeemed_count: number
  tier_required: string
  sort_order: number
  expires_at: string | null
  created_at: string
}

export interface RewardRedemption {
  id: string
  user_id: string
  reward_id: string
  earn_event_id: string | null
  status: 'pending' | 'redeemed' | 'expired' | 'cancelled'
  redeemed_at: string | null
  redeemed_by: string | null
  notes: string | null
  created_at: string
  expires_at: string | null
}

export interface Spirit {
  id: string
  name: string
  category: string
  subcategory: string | null
  producer: string | null
  region: string | null
  abv: number | null
  description: string | null
  image_url: string | null
  is_house: boolean
  is_featured: boolean
  is_active: boolean
  metadata: Json
  created_at: string
}

export interface TastingLog {
  id: string
  user_id: string
  spirit_id: string | null
  spirit_name: string | null
  spirit_category: string | null
  nose: string | null
  palate: string | null
  finish: string | null
  overall_notes: string | null
  rating: number | null
  location_id: string | null
  visited_at: string
  earn_event_id: string | null
  created_at: string
}

// ─── Database shape for createClient<Database>() ────────────
export interface Database {
  public: {
    Tables: {
      profiles:                { Row: Profile;            Insert: Partial<Profile>;            Update: Partial<Profile> }
      points_ledger:           { Row: PointsLedger;       Insert: Partial<PointsLedger>;       Update: Partial<PointsLedger> }
      tier_thresholds:         { Row: TierThreshold;      Insert: Partial<TierThreshold>;      Update: Partial<TierThreshold> }
      earn_events:             { Row: EarnEvent;          Insert: Partial<EarnEvent>;          Update: Partial<EarnEvent> }
      missions:                { Row: Mission;            Insert: Partial<Mission>;            Update: Partial<Mission> }
      mission_completions:     { Row: MissionCompletion;  Insert: Partial<MissionCompletion>;  Update: Partial<MissionCompletion> }
      challenges:              { Row: Challenge;          Insert: Partial<Challenge>;          Update: Partial<Challenge> }
      event_types:             { Row: EventType;          Insert: Partial<EventType>;          Update: Partial<EventType> }
      leaderboard_periods:     { Row: LeaderboardPeriod;  Insert: Partial<LeaderboardPeriod>;  Update: Partial<LeaderboardPeriod> }
      leaderboard_events:      { Row: LeaderboardEvent;   Insert: Partial<LeaderboardEvent>;   Update: Partial<LeaderboardEvent> }
      leaderboard_teams:       { Row: LeaderboardTeam;    Insert: Partial<LeaderboardTeam>;    Update: Partial<LeaderboardTeam> }
      rewards:                 { Row: Reward;             Insert: Partial<Reward>;             Update: Partial<Reward> }
      reward_redemptions:      { Row: RewardRedemption;   Insert: Partial<RewardRedemption>;   Update: Partial<RewardRedemption> }
      spirits:                 { Row: Spirit;             Insert: Partial<Spirit>;             Update: Partial<Spirit> }
      tasting_logs:            { Row: TastingLog;         Insert: Partial<TastingLog>;         Update: Partial<TastingLog> }
    }
    Views: {}
    Functions: {
      recalculate_tier: { Args: { p_user_id: string }; Returns: string }
    }
    Enums: {
      earn_event_type:    EarnEventType
      completion_trigger: CompletionTrigger
      redemption_method:  RedemptionMethod
    }
  }
}
