


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."completion_trigger" AS ENUM (
    'qr_scan',
    'manual_staff',
    'journal_entry',
    'toast_purchase',
    'event_attendance',
    'challenge_completion'
);


ALTER TYPE "public"."completion_trigger" OWNER TO "postgres";


CREATE TYPE "public"."earn_event_type" AS ENUM (
    'mission_completed',
    'journal_entry',
    'leaderboard_awarded',
    'reward_redeemed',
    'tier_unlocked',
    'badge_awarded',
    'staff_adjustment',
    'purchase_recorded'
);


ALTER TYPE "public"."earn_event_type" OWNER TO "postgres";


CREATE TYPE "public"."redemption_method" AS ENUM (
    'points',
    'leaderboard',
    'milestone',
    'streak',
    'tier_unlock',
    'staff_grant'
);


ALTER TYPE "public"."redemption_method" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, phone, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_tier"("p_user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_lifetime  integer;
  v_new_tier  text;
  v_old_tier  text;
BEGIN
  SELECT lifetime_earned INTO v_lifetime FROM public.points_ledger WHERE user_id = p_user_id;
  SELECT tier INTO v_old_tier FROM public.profiles WHERE id = p_user_id;

  SELECT tier INTO v_new_tier
  FROM public.tier_thresholds
  WHERE min_lifetime <= COALESCE(v_lifetime, 0)
  ORDER BY min_lifetime DESC
  LIMIT 1;

  v_new_tier := COALESCE(v_new_tier, 'newcomer');

  IF v_new_tier <> v_old_tier THEN
    UPDATE public.profiles SET tier = v_new_tier WHERE id = p_user_id;
    -- Emit tier unlock earn event (zero points, just a record)
    INSERT INTO public.earn_events (user_id, event_type, points_delta, notes)
    VALUES (p_user_id, 'tier_unlocked', 0, 'Reached tier: ' || v_new_tier);
  END IF;

  RETURN v_new_tier;
END;
$$;


ALTER FUNCTION "public"."recalculate_tier"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_points_ledger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.points_ledger (user_id, balance, lifetime_earned, lifetime_spent, last_updated_at)
  VALUES (
    NEW.user_id,
    GREATEST(0, NEW.points_delta),
    CASE WHEN NEW.points_delta > 0 THEN NEW.points_delta ELSE 0 END,
    CASE WHEN NEW.points_delta < 0 THEN ABS(NEW.points_delta) ELSE 0 END,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    balance         = GREATEST(0, points_ledger.balance + NEW.points_delta),
    lifetime_earned = points_ledger.lifetime_earned + CASE WHEN NEW.points_delta > 0 THEN NEW.points_delta ELSE 0 END,
    lifetime_spent  = points_ledger.lifetime_spent  + CASE WHEN NEW.points_delta < 0 THEN ABS(NEW.points_delta) ELSE 0 END,
    last_updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_points_ledger"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."challenge_completions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "challenge_id" "uuid" NOT NULL,
    "earn_event_id" "uuid",
    "completed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."challenge_completions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."challenge_missions" (
    "challenge_id" "uuid" NOT NULL,
    "mission_id" "uuid" NOT NULL
);


ALTER TABLE "public"."challenge_missions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "icon" "text" DEFAULT '🏅'::"text",
    "bonus_points" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true,
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "sort_order" integer DEFAULT 0,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."challenges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."earn_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_type" "public"."earn_event_type" NOT NULL,
    "points_delta" integer DEFAULT 0 NOT NULL,
    "context_type" "text",
    "context_id" "uuid",
    "location_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."earn_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "participant_type" "text" DEFAULT 'individual'::"text" NOT NULL,
    "scoring_method" "text" DEFAULT 'points'::"text" NOT NULL,
    "participation_mission_slug" "text",
    "win_mission_slug" "text",
    "placement_points" "jsonb" DEFAULT '{"1": 100, "2": 75, "3": 50, "participant": 25}'::"jsonb",
    "icon" "text" DEFAULT '🏆'::"text",
    "color" "text" DEFAULT '#f5c842'::"text",
    "day_of_week" integer,
    "typical_time" "text",
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "event_types_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6))),
    CONSTRAINT "event_types_participant_type_check" CHECK (("participant_type" = ANY (ARRAY['individual'::"text", 'team'::"text", 'both'::"text"]))),
    CONSTRAINT "event_types_scoring_method_check" CHECK (("scoring_method" = ANY (ARRAY['wins_losses'::"text", 'points'::"text", 'placement'::"text", 'time'::"text"])))
);


ALTER TABLE "public"."event_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leaderboard_cache" (
    "event_type_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "total_score" integer DEFAULT 0,
    "total_wins" integer DEFAULT 0,
    "total_losses" integer DEFAULT 0,
    "events_attended" integer DEFAULT 0,
    "best_placement" integer,
    "last_updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."leaderboard_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leaderboard_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "period_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "score" integer DEFAULT 0,
    "wins" integer DEFAULT 0,
    "losses" integer DEFAULT 0,
    "placement" integer,
    "earn_event_id" "uuid",
    "entered_by" "uuid",
    "entered_at" timestamp with time zone DEFAULT "now"(),
    "notes" "text"
);


ALTER TABLE "public"."leaderboard_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leaderboard_periods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "period_type" "text" DEFAULT 'weekly'::"text" NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone,
    "is_finalized" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "leaderboard_periods_period_type_check" CHECK (("period_type" = ANY (ARRAY['single_night'::"text", 'weekly'::"text", 'monthly'::"text", 'season'::"text", 'all_time'::"text"])))
);


ALTER TABLE "public"."leaderboard_periods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leaderboard_team_members" (
    "team_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."leaderboard_team_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leaderboard_teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "period_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "score" integer DEFAULT 0,
    "placement" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."leaderboard_teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "address" "text",
    "lat" numeric(10,7),
    "lng" numeric(10,7),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mission_completions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "mission_id" "uuid" NOT NULL,
    "earn_event_id" "uuid",
    "completed_at" timestamp with time zone DEFAULT "now"(),
    "completed_by" "uuid",
    "notes" "text"
);


ALTER TABLE "public"."mission_completions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."missions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "icon" "text" DEFAULT '🎯'::"text",
    "points" integer DEFAULT 50 NOT NULL,
    "completion_trigger" "public"."completion_trigger" NOT NULL,
    "is_repeatable" boolean DEFAULT false,
    "repeat_limit" integer,
    "repeat_cooldown_days" integer,
    "min_tier" "text" DEFAULT 'newcomer'::"text",
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."missions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "user_id" "uuid" NOT NULL,
    "leaderboard_results" boolean DEFAULT true,
    "mission_completed" boolean DEFAULT true,
    "new_events" boolean DEFAULT true,
    "points_earned" boolean DEFAULT false,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."points_ledger" (
    "user_id" "uuid" NOT NULL,
    "balance" integer DEFAULT 0 NOT NULL,
    "lifetime_earned" integer DEFAULT 0 NOT NULL,
    "lifetime_spent" integer DEFAULT 0 NOT NULL,
    "last_updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."points_ledger" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "phone" "text",
    "display_name" "text",
    "avatar_url" "text",
    "role" "text" DEFAULT 'customer'::"text" NOT NULL,
    "tier" "text" DEFAULT 'newcomer'::"text" NOT NULL,
    "pos_customer_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['customer'::"text", 'staff'::"text", 'admin'::"text"]))),
    CONSTRAINT "profiles_tier_check" CHECK (("tier" = ANY (ARRAY['newcomer'::"text", 'regular'::"text", 'spearer'::"text", 'harpooner'::"text", 'captain'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "last_used_at" timestamp with time zone
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."qr_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" NOT NULL,
    "mission_id" "uuid",
    "location_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:15:00'::interval) NOT NULL,
    "used_count" integer DEFAULT 0
);


ALTER TABLE "public"."qr_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reward_redemptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "reward_id" "uuid" NOT NULL,
    "earn_event_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "redeemed_at" timestamp with time zone,
    "redeemed_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '30 days'::interval),
    CONSTRAINT "reward_redemptions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'redeemed'::"text", 'expired'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."reward_redemptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rewards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "icon" "text" DEFAULT '🎁'::"text",
    "redemption_method" "public"."redemption_method" NOT NULL,
    "points_cost" integer DEFAULT 0,
    "trigger_params" "jsonb" DEFAULT '{}'::"jsonb",
    "reward_type" "text" DEFAULT 'drink'::"text" NOT NULL,
    "reward_value" "text",
    "is_active" boolean DEFAULT true,
    "max_per_user" integer,
    "total_supply" integer,
    "redeemed_count" integer DEFAULT 0,
    "tier_required" "text" DEFAULT 'newcomer'::"text",
    "sort_order" integer DEFAULT 0,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "rewards_reward_type_check" CHECK (("reward_type" = ANY (ARRAY['drink'::"text", 'discount'::"text", 'merchandise'::"text", 'experience'::"text", 'points_bonus'::"text", 'custom'::"text"])))
);


ALTER TABLE "public"."rewards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spirits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "subcategory" "text",
    "producer" "text",
    "region" "text",
    "abv" numeric(5,2),
    "description" "text",
    "image_url" "text",
    "is_house" boolean DEFAULT false,
    "is_featured" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "spirits_category_check" CHECK (("category" = ANY (ARRAY['whiskey'::"text", 'gin'::"text", 'vodka'::"text", 'rum'::"text", 'brandy'::"text", 'liqueur'::"text", 'beer'::"text", 'wine'::"text", 'cocktail'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."spirits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasting_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "spirit_id" "uuid",
    "spirit_name" "text",
    "spirit_category" "text",
    "nose" "text",
    "palate" "text",
    "finish" "text",
    "overall_notes" "text",
    "rating" integer,
    "location_id" "uuid",
    "visited_at" timestamp with time zone DEFAULT "now"(),
    "earn_event_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tasting_logs_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."tasting_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tier_thresholds" (
    "tier" "text" NOT NULL,
    "min_lifetime" integer NOT NULL,
    "label" "text" NOT NULL,
    "color" "text" NOT NULL,
    "perks" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "tier_thresholds_tier_check" CHECK (("tier" = ANY (ARRAY['newcomer'::"text", 'regular'::"text", 'spearer'::"text", 'harpooner'::"text", 'captain'::"text"])))
);


ALTER TABLE "public"."tier_thresholds" OWNER TO "postgres";


ALTER TABLE ONLY "public"."challenge_completions"
    ADD CONSTRAINT "challenge_completions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."challenge_completions"
    ADD CONSTRAINT "challenge_completions_user_id_challenge_id_key" UNIQUE ("user_id", "challenge_id");



ALTER TABLE ONLY "public"."challenge_missions"
    ADD CONSTRAINT "challenge_missions_pkey" PRIMARY KEY ("challenge_id", "mission_id");



ALTER TABLE ONLY "public"."challenges"
    ADD CONSTRAINT "challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."challenges"
    ADD CONSTRAINT "challenges_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."earn_events"
    ADD CONSTRAINT "earn_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_types"
    ADD CONSTRAINT "event_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_types"
    ADD CONSTRAINT "event_types_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."leaderboard_cache"
    ADD CONSTRAINT "leaderboard_cache_pkey" PRIMARY KEY ("event_type_id", "user_id");



ALTER TABLE ONLY "public"."leaderboard_events"
    ADD CONSTRAINT "leaderboard_events_period_id_user_id_key" UNIQUE ("period_id", "user_id");



ALTER TABLE ONLY "public"."leaderboard_events"
    ADD CONSTRAINT "leaderboard_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leaderboard_periods"
    ADD CONSTRAINT "leaderboard_periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leaderboard_team_members"
    ADD CONSTRAINT "leaderboard_team_members_pkey" PRIMARY KEY ("team_id", "user_id");



ALTER TABLE ONLY "public"."leaderboard_teams"
    ADD CONSTRAINT "leaderboard_teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."mission_completions"
    ADD CONSTRAINT "mission_completions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mission_completions"
    ADD CONSTRAINT "mission_completions_user_id_mission_id_completed_at_key" UNIQUE ("user_id", "mission_id", "completed_at");



ALTER TABLE ONLY "public"."missions"
    ADD CONSTRAINT "missions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."missions"
    ADD CONSTRAINT "missions_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."points_ledger"
    ADD CONSTRAINT "points_ledger_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE ("endpoint");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."qr_tokens"
    ADD CONSTRAINT "qr_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."qr_tokens"
    ADD CONSTRAINT "qr_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."reward_redemptions"
    ADD CONSTRAINT "reward_redemptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rewards"
    ADD CONSTRAINT "rewards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spirits"
    ADD CONSTRAINT "spirits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasting_logs"
    ADD CONSTRAINT "tasting_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tier_thresholds"
    ADD CONSTRAINT "tier_thresholds_pkey" PRIMARY KEY ("tier");



CREATE INDEX "earn_events_created_at_idx" ON "public"."earn_events" USING "btree" ("created_at" DESC);



CREATE INDEX "earn_events_event_type_idx" ON "public"."earn_events" USING "btree" ("event_type");



CREATE INDEX "earn_events_user_id_idx" ON "public"."earn_events" USING "btree" ("user_id");



CREATE INDEX "le_period_id_idx" ON "public"."leaderboard_events" USING "btree" ("period_id");



CREATE INDEX "le_user_id_idx" ON "public"."leaderboard_events" USING "btree" ("user_id");



CREATE INDEX "lp_event_type_idx" ON "public"."leaderboard_periods" USING "btree" ("event_type_id");



CREATE INDEX "mc_mission_id_idx" ON "public"."mission_completions" USING "btree" ("mission_id");



CREATE INDEX "mc_user_id_idx" ON "public"."mission_completions" USING "btree" ("user_id");



CREATE INDEX "rr_status_idx" ON "public"."reward_redemptions" USING "btree" ("status");



CREATE INDEX "rr_user_id_idx" ON "public"."reward_redemptions" USING "btree" ("user_id");



CREATE INDEX "tl_spirit_id_idx" ON "public"."tasting_logs" USING "btree" ("spirit_id");



CREATE INDEX "tl_user_id_idx" ON "public"."tasting_logs" USING "btree" ("user_id");



CREATE INDEX "tl_visited_at_idx" ON "public"."tasting_logs" USING "btree" ("visited_at" DESC);



CREATE OR REPLACE TRIGGER "earn_event_sync_ledger" AFTER INSERT ON "public"."earn_events" FOR EACH ROW EXECUTE FUNCTION "public"."sync_points_ledger"();



CREATE OR REPLACE TRIGGER "profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."challenge_completions"
    ADD CONSTRAINT "challenge_completions_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id");



ALTER TABLE ONLY "public"."challenge_completions"
    ADD CONSTRAINT "challenge_completions_earn_event_id_fkey" FOREIGN KEY ("earn_event_id") REFERENCES "public"."earn_events"("id");



ALTER TABLE ONLY "public"."challenge_completions"
    ADD CONSTRAINT "challenge_completions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenge_missions"
    ADD CONSTRAINT "challenge_missions_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."challenge_missions"
    ADD CONSTRAINT "challenge_missions_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id");



ALTER TABLE ONLY "public"."earn_events"
    ADD CONSTRAINT "earn_events_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."earn_events"
    ADD CONSTRAINT "earn_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_types"
    ADD CONSTRAINT "event_types_participation_mission_slug_fkey" FOREIGN KEY ("participation_mission_slug") REFERENCES "public"."missions"("slug");



ALTER TABLE ONLY "public"."event_types"
    ADD CONSTRAINT "event_types_win_mission_slug_fkey" FOREIGN KEY ("win_mission_slug") REFERENCES "public"."missions"("slug");



ALTER TABLE ONLY "public"."leaderboard_cache"
    ADD CONSTRAINT "leaderboard_cache_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id");



ALTER TABLE ONLY "public"."leaderboard_cache"
    ADD CONSTRAINT "leaderboard_cache_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."leaderboard_events"
    ADD CONSTRAINT "leaderboard_events_earn_event_id_fkey" FOREIGN KEY ("earn_event_id") REFERENCES "public"."earn_events"("id");



ALTER TABLE ONLY "public"."leaderboard_events"
    ADD CONSTRAINT "leaderboard_events_entered_by_fkey" FOREIGN KEY ("entered_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."leaderboard_events"
    ADD CONSTRAINT "leaderboard_events_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."leaderboard_periods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leaderboard_events"
    ADD CONSTRAINT "leaderboard_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leaderboard_periods"
    ADD CONSTRAINT "leaderboard_periods_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id");



ALTER TABLE ONLY "public"."leaderboard_team_members"
    ADD CONSTRAINT "leaderboard_team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."leaderboard_teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leaderboard_team_members"
    ADD CONSTRAINT "leaderboard_team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."leaderboard_teams"
    ADD CONSTRAINT "leaderboard_teams_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."leaderboard_periods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mission_completions"
    ADD CONSTRAINT "mission_completions_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."mission_completions"
    ADD CONSTRAINT "mission_completions_earn_event_id_fkey" FOREIGN KEY ("earn_event_id") REFERENCES "public"."earn_events"("id");



ALTER TABLE ONLY "public"."mission_completions"
    ADD CONSTRAINT "mission_completions_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id");



ALTER TABLE ONLY "public"."mission_completions"
    ADD CONSTRAINT "mission_completions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."points_ledger"
    ADD CONSTRAINT "points_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."qr_tokens"
    ADD CONSTRAINT "qr_tokens_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."qr_tokens"
    ADD CONSTRAINT "qr_tokens_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."qr_tokens"
    ADD CONSTRAINT "qr_tokens_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id");



ALTER TABLE ONLY "public"."reward_redemptions"
    ADD CONSTRAINT "reward_redemptions_earn_event_id_fkey" FOREIGN KEY ("earn_event_id") REFERENCES "public"."earn_events"("id");



ALTER TABLE ONLY "public"."reward_redemptions"
    ADD CONSTRAINT "reward_redemptions_redeemed_by_fkey" FOREIGN KEY ("redeemed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."reward_redemptions"
    ADD CONSTRAINT "reward_redemptions_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "public"."rewards"("id");



ALTER TABLE ONLY "public"."reward_redemptions"
    ADD CONSTRAINT "reward_redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasting_logs"
    ADD CONSTRAINT "tasting_logs_earn_event_id_fkey" FOREIGN KEY ("earn_event_id") REFERENCES "public"."earn_events"("id");



ALTER TABLE ONLY "public"."tasting_logs"
    ADD CONSTRAINT "tasting_logs_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."tasting_logs"
    ADD CONSTRAINT "tasting_logs_spirit_id_fkey" FOREIGN KEY ("spirit_id") REFERENCES "public"."spirits"("id");



ALTER TABLE ONLY "public"."tasting_logs"
    ADD CONSTRAINT "tasting_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE "public"."challenge_completions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "challenge_completions: own read" ON "public"."challenge_completions" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."challenge_missions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "challenge_missions: public read" ON "public"."challenge_missions" FOR SELECT USING (true);



ALTER TABLE "public"."challenges" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "challenges: public read" ON "public"."challenges" FOR SELECT USING (("is_active" = true));



ALTER TABLE "public"."earn_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "earn_events: own read" ON "public"."earn_events" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "earn_events: staff read" ON "public"."earn_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['staff'::"text", 'admin'::"text"]))))));



ALTER TABLE "public"."event_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_types: public read" ON "public"."event_types" FOR SELECT USING (("is_active" = true));



ALTER TABLE "public"."leaderboard_cache" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leaderboard_cache: public read" ON "public"."leaderboard_cache" FOR SELECT USING (true);



ALTER TABLE "public"."leaderboard_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leaderboard_events: public read" ON "public"."leaderboard_events" FOR SELECT USING (true);



CREATE POLICY "leaderboard_events: staff write" ON "public"."leaderboard_events" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['staff'::"text", 'admin'::"text"]))))));



ALTER TABLE "public"."leaderboard_periods" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leaderboard_periods: public read" ON "public"."leaderboard_periods" FOR SELECT USING (true);



ALTER TABLE "public"."leaderboard_team_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leaderboard_team_members: public read" ON "public"."leaderboard_team_members" FOR SELECT USING (true);



CREATE POLICY "leaderboard_team_members: staff write" ON "public"."leaderboard_team_members" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['staff'::"text", 'admin'::"text"]))))));



ALTER TABLE "public"."leaderboard_teams" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leaderboard_teams: public read" ON "public"."leaderboard_teams" FOR SELECT USING (true);



CREATE POLICY "leaderboard_teams: staff write" ON "public"."leaderboard_teams" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['staff'::"text", 'admin'::"text"]))))));



ALTER TABLE "public"."locations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "locations: public read" ON "public"."locations" FOR SELECT USING (true);



ALTER TABLE "public"."mission_completions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mission_completions: own read" ON "public"."mission_completions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "mission_completions: staff read" ON "public"."mission_completions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['staff'::"text", 'admin'::"text"]))))));



ALTER TABLE "public"."missions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "missions: public read" ON "public"."missions" FOR SELECT USING (("is_active" = true));



ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notification_preferences: own all" ON "public"."notification_preferences" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."points_ledger" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "points_ledger: own read" ON "public"."points_ledger" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "points_ledger: staff read" ON "public"."points_ledger" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['staff'::"text", 'admin'::"text"]))))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles: own read" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles: own update" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles: staff read" ON "public"."profiles" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['staff'::"text", 'admin'::"text"]))))));



ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "push_subscriptions: own all" ON "public"."push_subscriptions" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."qr_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "qr_tokens: staff read" ON "public"."qr_tokens" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['staff'::"text", 'admin'::"text"]))))));



ALTER TABLE "public"."reward_redemptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reward_redemptions: own read" ON "public"."reward_redemptions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "reward_redemptions: staff all" ON "public"."reward_redemptions" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['staff'::"text", 'admin'::"text"]))))));



ALTER TABLE "public"."rewards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rewards: public read" ON "public"."rewards" FOR SELECT USING (("is_active" = true));



ALTER TABLE "public"."spirits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "spirits: public read" ON "public"."spirits" FOR SELECT USING (("is_active" = true));



CREATE POLICY "spirits: staff write" ON "public"."spirits" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['staff'::"text", 'admin'::"text"]))))));



ALTER TABLE "public"."tasting_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tasting_logs: own all" ON "public"."tasting_logs" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."tier_thresholds" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tier_thresholds: public read" ON "public"."tier_thresholds" FOR SELECT USING (true);



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."challenge_completions" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."challenge_completions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."challenge_completions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."challenge_missions" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."challenge_missions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."challenge_missions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."challenges" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."challenges" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."challenges" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."earn_events" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."earn_events" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."earn_events" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."event_types" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."event_types" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."event_types" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."leaderboard_cache" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."leaderboard_cache" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."leaderboard_cache" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."leaderboard_events" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."leaderboard_events" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."leaderboard_events" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."leaderboard_periods" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."leaderboard_periods" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."leaderboard_periods" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."leaderboard_team_members" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."leaderboard_team_members" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."leaderboard_team_members" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."leaderboard_teams" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."leaderboard_teams" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."leaderboard_teams" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."locations" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."locations" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."locations" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."mission_completions" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."mission_completions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."mission_completions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."missions" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."missions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."missions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."notification_preferences" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."notification_preferences" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."points_ledger" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."points_ledger" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."points_ledger" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."push_subscriptions" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."qr_tokens" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."qr_tokens" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."qr_tokens" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reward_redemptions" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reward_redemptions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reward_redemptions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."rewards" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."rewards" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."rewards" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."spirits" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."spirits" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."spirits" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."tasting_logs" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."tasting_logs" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."tasting_logs" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."tier_thresholds" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."tier_thresholds" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."tier_thresholds" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";







