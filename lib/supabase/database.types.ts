export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          body: string
          created_at: string
          expired_count: number
          failed_count: number
          id: string
          sent_by: string | null
          sent_count: number
          subscriber_count: number
          tag: string | null
          target: Json
          title: string
          url: string
        }
        Insert: {
          body: string
          created_at?: string
          expired_count?: number
          failed_count?: number
          id?: string
          sent_by?: string | null
          sent_count?: number
          subscriber_count?: number
          tag?: string | null
          target?: Json
          title: string
          url?: string
        }
        Update: {
          body?: string
          created_at?: string
          expired_count?: number
          failed_count?: number
          id?: string
          sent_by?: string | null
          sent_count?: number
          subscriber_count?: number
          tag?: string | null
          target?: Json
          title?: string
          url?: string
        }
        Relationships: []
      }
      challenge_completions: {
        Row: {
          challenge_id: string
          completed_at: string | null
          earn_event_id: string | null
          id: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string | null
          earn_event_id?: string | null
          id?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string | null
          earn_event_id?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_completions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_completions_earn_event_id_fkey"
            columns: ["earn_event_id"]
            isOneToOne: false
            referencedRelation: "earn_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_missions: {
        Row: {
          challenge_id: string
          mission_id: string
        }
        Insert: {
          challenge_id: string
          mission_id: string
        }
        Update: {
          challenge_id?: string
          mission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_missions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_missions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          bonus_points: number
          created_at: string | null
          description: string | null
          ends_at: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          slug: string
          sort_order: number | null
          starts_at: string | null
          title: string
        }
        Insert: {
          bonus_points?: number
          created_at?: string | null
          description?: string | null
          ends_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          slug: string
          sort_order?: number | null
          starts_at?: string | null
          title: string
        }
        Update: {
          bonus_points?: number
          created_at?: string | null
          description?: string | null
          ends_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          slug?: string
          sort_order?: number | null
          starts_at?: string | null
          title?: string
        }
        Relationships: []
      }
      distillery_hours: {
        Row: {
          close_time: string | null
          closes_next_day: boolean
          created_at: string
          day_of_week: number | null
          id: string
          is_closed: boolean
          is_primary: boolean
          location: string
          note: string | null
          open_time: string | null
          override_date: string | null
          raw_hours_text: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          close_time?: string | null
          closes_next_day?: boolean
          created_at?: string
          day_of_week?: number | null
          id?: string
          is_closed?: boolean
          is_primary?: boolean
          location: string
          note?: string | null
          open_time?: string | null
          override_date?: string | null
          raw_hours_text?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          close_time?: string | null
          closes_next_day?: boolean
          created_at?: string
          day_of_week?: number | null
          id?: string
          is_closed?: boolean
          is_primary?: boolean
          location?: string
          note?: string | null
          open_time?: string | null
          override_date?: string | null
          raw_hours_text?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      earn_events: {
        Row: {
          context_id: string | null
          context_type: string | null
          created_at: string | null
          event_type: Database["public"]["Enums"]["earn_event_type"]
          id: string
          location_id: string | null
          notes: string | null
          points_delta: number
          user_id: string
        }
        Insert: {
          context_id?: string | null
          context_type?: string | null
          created_at?: string | null
          event_type: Database["public"]["Enums"]["earn_event_type"]
          id?: string
          location_id?: string | null
          notes?: string | null
          points_delta?: number
          user_id: string
        }
        Update: {
          context_id?: string | null
          context_type?: string | null
          created_at?: string | null
          event_type?: Database["public"]["Enums"]["earn_event_type"]
          id?: string
          location_id?: string | null
          notes?: string | null
          points_delta?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "earn_events_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "earn_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_types: {
        Row: {
          color: string | null
          created_at: string | null
          day_of_week: number | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          participant_type: string
          participation_mission_slug: string | null
          placement_points: Json | null
          schedule_label: string | null
          scoring_method: string
          slug: string
          sort_order: number | null
          typical_time: string | null
          win_mission_slug: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          day_of_week?: number | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          participant_type?: string
          participation_mission_slug?: string | null
          placement_points?: Json | null
          schedule_label?: string | null
          scoring_method?: string
          slug: string
          sort_order?: number | null
          typical_time?: string | null
          win_mission_slug?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          day_of_week?: number | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          participant_type?: string
          participation_mission_slug?: string | null
          placement_points?: Json | null
          schedule_label?: string | null
          scoring_method?: string
          slug?: string
          sort_order?: number | null
          typical_time?: string | null
          win_mission_slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_types_participation_mission_slug_fkey"
            columns: ["participation_mission_slug"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "event_types_win_mission_slug_fkey"
            columns: ["win_mission_slug"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["slug"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          event_date: string
          event_type_id: string | null
          id: string
          is_cancelled: boolean | null
          notes: string | null
          start_time: string | null
        }
        Insert: {
          created_at?: string | null
          event_date: string
          event_type_id?: string | null
          id?: string
          is_cancelled?: boolean | null
          notes?: string | null
          start_time?: string | null
        }
        Update: {
          created_at?: string | null
          event_date?: string
          event_type_id?: string | null
          id?: string
          is_cancelled?: boolean | null
          notes?: string | null
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_cache: {
        Row: {
          best_placement: number | null
          event_type_id: string
          events_attended: number | null
          last_updated_at: string | null
          total_losses: number | null
          total_score: number | null
          total_wins: number | null
          user_id: string
        }
        Insert: {
          best_placement?: number | null
          event_type_id: string
          events_attended?: number | null
          last_updated_at?: string | null
          total_losses?: number | null
          total_score?: number | null
          total_wins?: number | null
          user_id: string
        }
        Update: {
          best_placement?: number | null
          event_type_id?: string
          events_attended?: number | null
          last_updated_at?: string | null
          total_losses?: number | null
          total_score?: number | null
          total_wins?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_cache_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_cache_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_events: {
        Row: {
          earn_event_id: string | null
          entered_at: string | null
          entered_by: string | null
          id: string
          losses: number | null
          notes: string | null
          period_id: string
          placement: number | null
          score: number | null
          user_id: string
          wins: number | null
        }
        Insert: {
          earn_event_id?: string | null
          entered_at?: string | null
          entered_by?: string | null
          id?: string
          losses?: number | null
          notes?: string | null
          period_id: string
          placement?: number | null
          score?: number | null
          user_id: string
          wins?: number | null
        }
        Update: {
          earn_event_id?: string | null
          entered_at?: string | null
          entered_by?: string | null
          id?: string
          losses?: number | null
          notes?: string | null
          period_id?: string
          placement?: number | null
          score?: number | null
          user_id?: string
          wins?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_events_earn_event_id_fkey"
            columns: ["earn_event_id"]
            isOneToOne: false
            referencedRelation: "earn_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_events_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_events_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_periods: {
        Row: {
          created_at: string | null
          ends_at: string | null
          event_id: string | null
          event_type_id: string
          id: string
          is_finalized: boolean | null
          join_token: string | null
          label: string
          period_type: string
          starts_at: string
        }
        Insert: {
          created_at?: string | null
          ends_at?: string | null
          event_id?: string | null
          event_type_id: string
          id?: string
          is_finalized?: boolean | null
          join_token?: string | null
          label: string
          period_type?: string
          starts_at: string
        }
        Update: {
          created_at?: string | null
          ends_at?: string | null
          event_id?: string | null
          event_type_id?: string
          id?: string
          is_finalized?: boolean | null
          join_token?: string | null
          label?: string
          period_type?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_periods_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_periods_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_team_members: {
        Row: {
          team_id: string
          user_id: string
        }
        Insert: {
          team_id: string
          user_id: string
        }
        Update: {
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_teams: {
        Row: {
          created_at: string | null
          id: string
          name: string
          period_id: string
          permanent_team_id: string | null
          placement: number | null
          score: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          period_id: string
          permanent_team_id?: string | null
          placement?: number | null
          score?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          period_id?: string
          permanent_team_id?: string | null
          placement?: number | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_teams_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_teams_permanent_team_id_fkey"
            columns: ["permanent_team_id"]
            isOneToOne: false
            referencedRelation: "permanent_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          lat: number | null
          lng: number | null
          name: string
          slug: string
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          lat?: number | null
          lng?: number | null
          name: string
          slug: string
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          lat?: number | null
          lng?: number | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      mission_completion_requests: {
        Row: {
          created_at: string
          id: string
          mission_id: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mission_id: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mission_id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_completion_requests_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_completions: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          earn_event_id: string | null
          id: string
          mission_id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          earn_event_id?: string | null
          id?: string
          mission_id: string
          notes?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          earn_event_id?: string | null
          id?: string
          mission_id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_completions_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_completions_earn_event_id_fkey"
            columns: ["earn_event_id"]
            isOneToOne: false
            referencedRelation: "earn_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_completions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          completion_trigger: Database["public"]["Enums"]["completion_trigger"]
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_repeatable: boolean | null
          metadata: Json | null
          min_tier: string | null
          points: number
          repeat_cooldown_days: number | null
          repeat_limit: number | null
          slug: string
          sort_order: number | null
          title: string
        }
        Insert: {
          completion_trigger: Database["public"]["Enums"]["completion_trigger"]
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_repeatable?: boolean | null
          metadata?: Json | null
          min_tier?: string | null
          points?: number
          repeat_cooldown_days?: number | null
          repeat_limit?: number | null
          slug: string
          sort_order?: number | null
          title: string
        }
        Update: {
          completion_trigger?: Database["public"]["Enums"]["completion_trigger"]
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_repeatable?: boolean | null
          metadata?: Json | null
          min_tier?: string | null
          points?: number
          repeat_cooldown_days?: number | null
          repeat_limit?: number | null
          slug?: string
          sort_order?: number | null
          title?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          leaderboard_results: boolean | null
          mission_completed: boolean | null
          new_events: boolean | null
          points_earned: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          leaderboard_results?: boolean | null
          mission_completed?: boolean | null
          new_events?: boolean | null
          points_earned?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          leaderboard_results?: boolean | null
          mission_completed?: boolean | null
          new_events?: boolean | null
          points_earned?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permanent_teams: {
        Row: {
          created_at: string | null
          event_type_id: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          event_type_id: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          event_type_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "permanent_teams_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
        ]
      }
      points_ledger: {
        Row: {
          balance: number
          last_updated_at: string | null
          lifetime_earned: number
          lifetime_spent: number
          user_id: string
        }
        Insert: {
          balance?: number
          last_updated_at?: string | null
          lifetime_earned?: number
          lifetime_spent?: number
          user_id: string
        }
        Update: {
          balance?: number
          last_updated_at?: string | null
          lifetime_earned?: number
          lifetime_spent?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          birthday: string | null
          created_at: string | null
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          last_initial: string | null
          phone: string | null
          pos_customer_id: string | null
          preferred_name: string | null
          role: string
          tier: string
          toast_customer_id: string | null
          toast_metadata: Json | null
          toast_spend_cents: number | null
          toast_tier: string | null
          toast_visits: number | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          birthday?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          last_initial?: string | null
          phone?: string | null
          pos_customer_id?: string | null
          preferred_name?: string | null
          role?: string
          tier?: string
          toast_customer_id?: string | null
          toast_metadata?: Json | null
          toast_spend_cents?: number | null
          toast_tier?: string | null
          toast_visits?: number | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          birthday?: string | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          last_initial?: string | null
          phone?: string | null
          pos_customer_id?: string | null
          preferred_name?: string | null
          role?: string
          tier?: string
          toast_customer_id?: string | null
          toast_metadata?: Json | null
          toast_spend_cents?: number | null
          toast_tier?: string | null
          toast_visits?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_tokens: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string
          id: string
          location_id: string | null
          mission_id: string | null
          token: string
          used_count: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string
          id?: string
          location_id?: string | null
          mission_id?: string | null
          token: string
          used_count?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string
          id?: string
          location_id?: string | null
          mission_id?: string | null
          token?: string
          used_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "qr_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_tokens_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_tokens_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          author: string | null
          created_at: string | null
          flavor_tags: string[] | null
          glassware: string | null
          grocery_override: string | null
          id: string
          ingredients: string[] | null
          instructions: string | null
          is_active: boolean | null
          is_event_menu: boolean | null
          menu_ingredients: string | null
          menu_section: string | null
          name: string
          notes: string | null
          photo_url: string | null
          price: number | null
          recipe_date: string | null
          section_sort_order: number | null
          show_on_menu: boolean | null
          sort_order: number | null
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          author?: string | null
          created_at?: string | null
          flavor_tags?: string[] | null
          glassware?: string | null
          grocery_override?: string | null
          id?: string
          ingredients?: string[] | null
          instructions?: string | null
          is_active?: boolean | null
          is_event_menu?: boolean | null
          menu_ingredients?: string | null
          menu_section?: string | null
          name: string
          notes?: string | null
          photo_url?: string | null
          price?: number | null
          recipe_date?: string | null
          section_sort_order?: number | null
          show_on_menu?: boolean | null
          sort_order?: number | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          author?: string | null
          created_at?: string | null
          flavor_tags?: string[] | null
          glassware?: string | null
          grocery_override?: string | null
          id?: string
          ingredients?: string[] | null
          instructions?: string | null
          is_active?: boolean | null
          is_event_menu?: boolean | null
          menu_ingredients?: string | null
          menu_section?: string | null
          name?: string
          notes?: string | null
          photo_url?: string | null
          price?: number | null
          recipe_date?: string | null
          section_sort_order?: number | null
          show_on_menu?: boolean | null
          sort_order?: number | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      reward_redemptions: {
        Row: {
          created_at: string | null
          earn_event_id: string | null
          expires_at: string | null
          id: string
          notes: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          reward_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          earn_event_id?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          reward_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          earn_event_id?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          reward_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_redemptions_earn_event_id_fkey"
            columns: ["earn_event_id"]
            isOneToOne: false
            referencedRelation: "earn_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_redeemed_by_fkey"
            columns: ["redeemed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          created_at: string | null
          description: string | null
          expires_at: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          max_per_user: number | null
          name: string
          points_cost: number | null
          redeemed_count: number | null
          redemption_method: Database["public"]["Enums"]["redemption_method"]
          reward_type: string
          reward_value: string | null
          sort_order: number | null
          tier_required: string | null
          total_supply: number | null
          trigger_params: Json | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          max_per_user?: number | null
          name: string
          points_cost?: number | null
          redeemed_count?: number | null
          redemption_method: Database["public"]["Enums"]["redemption_method"]
          reward_type?: string
          reward_value?: string | null
          sort_order?: number | null
          tier_required?: string | null
          total_supply?: number | null
          trigger_params?: Json | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          max_per_user?: number | null
          name?: string
          points_cost?: number | null
          redeemed_count?: number | null
          redemption_method?: Database["public"]["Enums"]["redemption_method"]
          reward_type?: string
          reward_value?: string | null
          sort_order?: number | null
          tier_required?: string | null
          total_supply?: number | null
          trigger_params?: Json | null
        }
        Relationships: []
      }
      spirits: {
        Row: {
          abv: number | null
          category: string
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_featured: boolean | null
          is_house: boolean | null
          metadata: Json | null
          name: string
          producer: string | null
          region: string | null
          subcategory: string | null
        }
        Insert: {
          abv?: number | null
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          is_house?: boolean | null
          metadata?: Json | null
          name: string
          producer?: string | null
          region?: string | null
          subcategory?: string | null
        }
        Update: {
          abv?: number | null
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          is_house?: boolean | null
          metadata?: Json | null
          name?: string
          producer?: string | null
          region?: string | null
          subcategory?: string | null
        }
        Relationships: []
      }
      tasting_logs: {
        Row: {
          created_at: string | null
          earn_event_id: string | null
          finish: string | null
          id: string
          location_id: string | null
          nose: string | null
          overall_notes: string | null
          palate: string | null
          rating: number | null
          recipe_id: string | null
          spirit_category: string | null
          spirit_id: string | null
          spirit_name: string | null
          user_id: string
          visited_at: string | null
        }
        Insert: {
          created_at?: string | null
          earn_event_id?: string | null
          finish?: string | null
          id?: string
          location_id?: string | null
          nose?: string | null
          overall_notes?: string | null
          palate?: string | null
          rating?: number | null
          recipe_id?: string | null
          spirit_category?: string | null
          spirit_id?: string | null
          spirit_name?: string | null
          user_id: string
          visited_at?: string | null
        }
        Update: {
          created_at?: string | null
          earn_event_id?: string | null
          finish?: string | null
          id?: string
          location_id?: string | null
          nose?: string | null
          overall_notes?: string | null
          palate?: string | null
          rating?: number | null
          recipe_id?: string | null
          spirit_category?: string | null
          spirit_id?: string | null
          spirit_name?: string | null
          user_id?: string
          visited_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasting_logs_earn_event_id_fkey"
            columns: ["earn_event_id"]
            isOneToOne: false
            referencedRelation: "earn_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasting_logs_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasting_logs_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasting_logs_spirit_id_fkey"
            columns: ["spirit_id"]
            isOneToOne: false
            referencedRelation: "spirits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasting_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tier_thresholds: {
        Row: {
          color: string
          label: string
          min_lifetime: number
          perks: Json | null
          tier: string
        }
        Insert: {
          color: string
          label: string
          min_lifetime: number
          perks?: Json | null
          tier: string
        }
        Update: {
          color?: string
          label?: string
          min_lifetime?: number
          perks?: Json | null
          tier?: string
        }
        Relationships: []
      }
      toast_loyalty_accounts: {
        Row: {
          accrue_count: number | null
          birthday: string | null
          card_number: string | null
          email: string | null
          first_trans_at: string | null
          id: string
          imported_at: string | null
          is_classic_card: boolean | null
          is_deactivated: boolean | null
          last_trans_at: string | null
          phone: string | null
          points_imported: boolean | null
          profile_id: string | null
          redeem_count: number | null
          toast_account_id: string
          toast_card_id: string
          toast_points: number | null
          updated_at: string | null
        }
        Insert: {
          accrue_count?: number | null
          birthday?: string | null
          card_number?: string | null
          email?: string | null
          first_trans_at?: string | null
          id?: string
          imported_at?: string | null
          is_classic_card?: boolean | null
          is_deactivated?: boolean | null
          last_trans_at?: string | null
          phone?: string | null
          points_imported?: boolean | null
          profile_id?: string | null
          redeem_count?: number | null
          toast_account_id: string
          toast_card_id: string
          toast_points?: number | null
          updated_at?: string | null
        }
        Update: {
          accrue_count?: number | null
          birthday?: string | null
          card_number?: string | null
          email?: string | null
          first_trans_at?: string | null
          id?: string
          imported_at?: string | null
          is_classic_card?: boolean | null
          is_deactivated?: boolean | null
          last_trans_at?: string | null
          phone?: string | null
          points_imported?: boolean | null
          profile_id?: string | null
          redeem_count?: number | null
          toast_account_id?: string
          toast_card_id?: string
          toast_points?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "toast_loyalty_accounts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trivia_team_members: {
        Row: {
          team_id: string
          user_id: string
        }
        Insert: {
          team_id: string
          user_id: string
        }
        Update: {
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trivia_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "trivia_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trivia_team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trivia_teams: {
        Row: {
          created_at: string | null
          event_type_id: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          event_type_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          event_type_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "trivia_teams_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_is_staff: { Args: never; Returns: boolean }
      recalculate_tier: { Args: { p_user_id: string }; Returns: string }
    }
    Enums: {
      completion_trigger:
        | "qr_scan"
        | "manual_staff"
        | "journal_entry"
        | "toast_purchase"
        | "event_attendance"
        | "challenge_completion"
      earn_event_type:
        | "mission_completed"
        | "journal_entry"
        | "leaderboard_awarded"
        | "reward_redeemed"
        | "tier_unlocked"
        | "badge_awarded"
        | "staff_adjustment"
        | "purchase_recorded"
        | "bar_checkin"
        | "journal_entry_removed"
      redemption_method:
        | "points"
        | "leaderboard"
        | "milestone"
        | "streak"
        | "tier_unlock"
        | "staff_grant"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      completion_trigger: [
        "qr_scan",
        "manual_staff",
        "journal_entry",
        "toast_purchase",
        "event_attendance",
        "challenge_completion",
      ],
      earn_event_type: [
        "mission_completed",
        "journal_entry",
        "leaderboard_awarded",
        "reward_redeemed",
        "tier_unlocked",
        "badge_awarded",
        "staff_adjustment",
        "purchase_recorded",
        "bar_checkin",
        "journal_entry_removed",
      ],
      redemption_method: [
        "points",
        "leaderboard",
        "milestone",
        "streak",
        "tier_unlock",
        "staff_grant",
      ],
    },
  },
} as const
