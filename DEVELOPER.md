# Spearers Club — Developer Documentation

## Overview

Spearers Club is the loyalty and gamification app for Sturgeon Spirits Inc., a cocktail bar in [city]. Customers earn points by checking in, completing missions, logging tastings, and competing in weekly events like Cribbage Night and Trivia. Points unlock tiers, rewards, and leaderboard glory.

**Live URL:** https://club.sturgeonspirits.com  
**Hosting:** Netlify (serverless functions)  
**Database:** Supabase (PostgreSQL with Row Level Security)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 App Router |
| Language | TypeScript |
| Styling | Tailwind CSS (utility classes) |
| Database | Supabase (PostgreSQL + PostgREST + Auth) |
| Auth | Supabase Auth — OTP email magic links |
| Hosting | Netlify (Next.js on Lambda) |
| Push Notifications | Web Push API + VAPID |
| QR Scanning | `jsQR` + `getUserMedia` in-browser |
| Fonts | `@fontsource` (self-hosted, no Google Fonts network dep) |
| PWA | `next-pwa` with custom service worker |

---

## Local Development Setup

### Prerequisites

- Node.js 20+
- A Supabase project (cloud or local)
- npm

### 1. Clone and install

```bash
git clone <repo-url>
cd sturgeon-app
npm install
```

### 2. Environment variables

Copy `.env.local.example` to `.env.local` and fill in all values.

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key (never expose to browser) |
| `QR_HMAC_SECRET` | ✅ | 32-byte hex secret for signing daily QR tokens. Generate: `openssl rand -hex 32` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | ✅ | VAPID public key for Web Push. Generate: `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | ✅ | VAPID private key |
| `VAPID_SUBJECT` | ✅ | VAPID subject (e.g. `mailto:info@sturgeonspirits.com`) |
| `NEXT_PUBLIC_APP_URL` | Recommended | Full app URL (e.g. `https://club.sturgeonspirits.com`) |
| `CRON_SECRET` | Recommended | Secret for scheduled task auth header |
| `NEXT_PUBLIC_DEV_EMAIL` | Dev only | Email for dev bypass login |

The app validates all required variables at startup via `lib/env.ts`. If any are missing, the server won't start and the error message will list exactly which ones.

### 3. Run dev server

```bash
npm run dev
```

### 4. Dev login bypass

In development, navigate to `/dev-login` for a passwordless login bypass. This route is disabled in production.

---

## Project Structure

```
app/
  (consumer)/          # Customer-facing routes (auth-gated)
    club/              # Home screen — points, missions, challenges
    checkin/           # QR check-in flow
      scan/            # In-app camera QR scanner
    events/            # Upcoming events + Facebook integration
    journal/           # Tasting journal
    leaderboards/      # Leaderboard list + [slug] detail
    menu/              # Cocktail menu
    profile/           # Points history, birthday, sign-out
    rewards/           # Reward catalog + redemption history
    privacy/           # Privacy policy
  staff/               # Staff-only routes (role-gated)
    page.tsx           # Staff home with quick links
    dashboard/         # Metrics: members, points, top lists
    customers/         # Customer search + profiles
    events/            # Manage event types + schedule
    missions/          # Review mission completion requests
    redemptions/       # Approve/reject pending reward redemptions
    rewards/           # Manage reward catalog
    scores/            # Submit leaderboard scores
    toast-sync/        # Trigger Toast POS data import
  api/                 # API routes (see API Routes section)
  auth/                # Login, verify OTP, callback
  layout.tsx           # Root layout: fonts, nav, PWA metadata
  globals.css          # Brand colors, CSS variables, base styles
  not-found.tsx        # Custom 404

components/
  club/                # TierProgress, MissionGrid, MissionCard, ShopMenu
  events/              # EventSignupForm, IndividualSignupForm
  journal/             # JournalForm, JournalSearch, JournalEditForm
  leaderboard/         # LeaderboardBoard
  menu/                # MenuSearch
  nav/                 # ConsumerNav (bottom tab bar), StaffNavBar
  profile/             # BirthdayEditor
  rewards/             # RedeemButton
  staff/               # Various staff UI components
  ui/                  # Shared primitives

lib/
  supabase/
    server.ts          # createClient(), createServiceClient(), getAuthUser()
    client.ts          # Browser-side Supabase client
    database.types.ts  # Generated Supabase TypeScript types
  checkin-token.ts     # Daily HMAC QR token generation + validation
  earn-events.ts       # emitEarnEvent() — all point mutations go here
  env.ts               # Environment variable validation + typed constants
  rate-limit.ts        # In-memory sliding-window rate limiter
  utils.ts             # tierLabel, tierColor, formatPoints, relativeTime

supabase/
  migrations/          # Ordered SQL migration files

instrumentation.ts     # Next.js startup hook — validates env vars
middleware.ts          # Auth session refresh + redirect logic
```

---

## Authentication

Auth is **email OTP only** (magic links). No passwords are ever stored.

**Flow:**
1. User enters email → POST `/api/auth` → Supabase sends 6-digit OTP
2. User enters OTP → Supabase issues session JWT stored in cookies
3. Middleware calls `supabase.auth.getUser()` on every request to refresh session
4. Page components use `getAuthUser()` (local JWT read, no network call) to avoid doubling latency

**Role system:**
- Roles are stored in `auth.users.app_metadata.role` (set by Supabase service role, not editable by users)
- Also mirrored to `profiles.role` as a readable fallback
- Roles: `customer` (default), `staff`, `admin`
- Staff pages check both locations: `app_metadata.role` first, `profiles.role` as fallback

**Important:** Never trust `profiles.role` alone for security decisions — always check `app_metadata` first.

---

## Database Schema

All tables live in the `public` schema with Row Level Security enabled. The service role bypasses RLS and is used in API routes for privileged operations.

### Core tables

| Table | Purpose |
|---|---|
| `profiles` | One row per user. `display_name`, `tier`, `birthday` (MM/DD), `role`, `full_name`, `phone` |
| `points_ledger` | Running balance per user. Updated by `sync_points_ledger` trigger on `earn_events` |
| `earn_events` | Immutable audit log of every point change. Never update rows — always insert |
| `tier_thresholds` | `(tier, min_lifetime)` — defines when each tier unlocks |

### Missions & challenges

| Table | Purpose |
|---|---|
| `missions` | Earn-once or repeatable tasks. `completion_trigger` enum controls how they complete |
| `mission_completions` | One row per user per mission completion |
| `mission_completion_requests` | Pending requests from "I did this!" button. Staff approves/rejects |
| `challenges` | Multi-mission collections with bonus points |
| `challenge_missions` | Join table: which missions belong to a challenge |
| `challenge_completions` | When a user finishes an entire challenge |

**`completion_trigger` enum values:**
- `qr_scan` — completed automatically at check-in
- `manual_staff` — requires staff approval
- `journal_entry` — completed when a tasting log is submitted
- `toast_purchase` — triggered by Toast POS sync
- `event_attendance` — auto-awarded when a leaderboard score is submitted for the user
- `challenge_completion` — awarded when a parent challenge is completed

### Leaderboards & events

| Table | Purpose |
|---|---|
| `event_types` | Recurring event definitions (Cribbage Night, Trivia, etc.) |
| `events` | Specific dated instances of an event type |
| `leaderboard_periods` | One period per event night. Contains `starts_at`, `is_finalized` |
| `leaderboard_events` | Individual scores/entries within a period |

### Rewards

| Table | Purpose |
|---|---|
| `rewards` | Reward catalog. `redemption_method` enum controls how it can be earned |
| `reward_redemptions` | Customer requests to redeem a reward. Staff approves |

**`redemption_method` enum values:**
- `points` — customer spends points
- `leaderboard` — auto-awarded for winning an event
- `milestone` / `streak` / `tier_unlock` — automatically triggered
- `staff_grant` — staff awards manually

### Other tables

| Table | Purpose |
|---|---|
| `recipes` | Cocktail menu synced from Toast POS |
| `tasting_logs` | Customer journal entries |
| `push_subscriptions` | Web Push subscription endpoints |
| `toast_loyalty_accounts` | Linked Toast loyalty card data |

### Key database functions (Postgres)

- `handle_new_user()` — trigger on `auth.users` insert; creates a `profiles` row automatically
- `sync_points_ledger()` — trigger on `earn_events` insert; keeps `points_ledger` in sync
- `recalculate_tier(user_id)` — called after each earn event; upgrades tier if threshold crossed

---

## Points System

**All point mutations go through `emitEarnEvent()` in `lib/earn-events.ts`.** This function:
1. Inserts a row into `earn_events`
2. The `sync_points_ledger` Postgres trigger fires automatically, updating balance/lifetime/spent
3. `recalculate_tier()` is called to check for tier upgrades

**Never update `points_ledger` directly.** It is a derived table maintained by the trigger.

### Point values (as of April 2026)

| Action | Points |
|---|---|
| Daily check-in | +15 |
| Attend Cribbage Night | +15 |
| Win at Cribbage | +25 |
| Attend Trivia Night | +15 |
| Win at Trivia | +25 |
| Tasting journal entry | +10 |
| Birthday cocktail | 0 pts (reward redemption, no points) |

### Tiers

Tiers are based on **lifetime earned points** (not current balance):

| Tier | Display Name | Threshold |
|---|---|---|
| newcomer | Fingerling | 0 pts |
| regular | Shanty | (set in tier_thresholds) |
| spearer | Spearer | (set in tier_thresholds) |
| harpooner | Harpooner | (set in tier_thresholds) |
| captain | Captain | (set in tier_thresholds) |

---

## API Routes

All routes under `app/api/`. Routes that require staff use an internal `assertStaff()` pattern checking `app_metadata.role`.

### Customer-facing

| Route | Method | Description |
|---|---|---|
| `/api/checkin` | POST | Validate QR token, award check-in points, detect birthday |
| `/api/rewards/redeem` | POST | Create pending reward redemption request |
| `/api/missions/request-completion` | POST | Customer submits "I did this!" for manual missions |
| `/api/journal-entry` | POST | Submit a tasting log entry and award points |
| `/api/push/subscribe` | POST | Save a Web Push subscription |
| `/api/profile/birthday` | PATCH | Update birthday (MM/DD) |
| `/api/join/team` | POST | Join a trivia team |
| `/api/join/leave` | POST | Leave a team |
| `/api/join/create-team` | POST | Create a new trivia team |

### Staff-only

| Route | Method | Description |
|---|---|---|
| `/api/staff/leaderboard-score` | POST | Submit score for a player, auto-awards event attendance mission |
| `/api/staff/redeem` | POST | Approve a reward redemption, deduct points |
| `/api/staff/complete-mission` | POST | Manually award a mission to a customer |
| `/api/staff/approve-mission-request` | POST | Approve/reject a pending mission request |
| `/api/staff/customer-search` | GET | Search customers by name/email |
| `/api/staff/manual-checkin` | POST | Check in a customer without QR |
| `/api/staff/toast-sync` | POST | Trigger Toast POS data import |
| `/api/staff/generate-qr` | POST | Generate a signed QR code for the current day |

### Scheduled / system

| Route | Method | Description |
|---|---|---|
| `/api/push/event-reminder` | POST | Send push notifications for upcoming events (called by cron) |
| `/api/sync-menu` | POST | Pull Google Sheet → Supabase `recipes`. Triggered by staff button and by a daily cron. |

**Cron authentication:** Scheduled routes accept an `x-cron-secret` header matching `CRON_SECRET`. The menu sync is scheduled via **Supabase pg_cron** (see `supabase/cron/setup-daily-menu-sync.sql`); other scheduled jobs can use the same pattern, GitHub Actions, or any external cron service. `/api/sync-menu` additionally accepts `x-sync-secret: SYNC_SECRET` so the staff "Sync Menu" button keeps working.

---

## QR Check-In System

There are two QR token systems in use:

**Daily HMAC token** (`lib/checkin-token.ts`):
- HMAC-SHA256 of today's date (Chicago time) using `QR_HMAC_SECRET`
- Rotates at midnight; yesterday's token also accepted (midnight buffer)
- Used by the staff QR display and the `/checkin?t=TOKEN` route

**JWT QR code** (`/api/staff/generate-qr`):
- Short-lived JWT signed with `QR_HMAC_SECRET`
- Generated on-demand for the in-app scanner flow

The in-app scanner (`/checkin/scan`) uses `getUserMedia` + `jsQR` to scan without leaving the browser.

---

## Leaderboards

Leaderboards are organized as: **Event Type → Periods → Events/Scores**

- Each event night has one `leaderboard_period` row
- Scores are individual `leaderboard_events` rows within a period
- Periods are finalized by staff after the event closes
- The all-time view aggregates across all finalized periods using `unstable_cache` (1-minute TTL, tag-invalidated on new score submission)
- The leaderboard detail page defaults to the most recent past or same-day event

---

## Toast POS Integration

Sturgeon Spirits uses Toast POS. The integration:
1. Staff triggers a sync from `/staff/toast-sync`
2. `/api/staff/toast-sync` calls Toast's loyalty API
3. Matched customers (by email/phone) get their Toast points imported as `earn_events` with `context_type = 'toast_import'`
4. The Toast account row is saved in `toast_loyalty_accounts` for deduplication

Birthdays are **not** synced from Toast — customers enter them in-app.

---

## Performance Notes

- **`getAuthUser()` pattern** — page components use `getSession()` (local JWT read) instead of `getUser()` (network call). Middleware handles the one authoritative `getUser()` per request. Saves ~100-200ms per page.
- **`unstable_cache`** — all-time leaderboard aggregations are cached with a 1-minute TTL and tag-invalidated on score submission via `revalidateTag()`.
- **`Promise.all`** — all independent Supabase queries on a page run in parallel.
- **`jsQR` dynamic import** — the QR scanning library is only loaded when the scan page is opened, keeping the main bundle lean.

---

## Deployment (Netlify)

The app deploys automatically from the `main` branch.

**Required Netlify environment variables:** All variables listed in the Environment Variables section above must be set in Netlify → Site configuration → Environment variables.

**Build command:** `npm run build`  
**Publish directory:** `.next`  
**Plugin:** `@netlify/plugin-nextjs`

**After deploying schema changes:** Run migrations manually in the Supabase SQL editor, or use `supabase db push` if the Supabase CLI is configured.

---

## Common Tasks

### Add a new mission

1. Insert a row into `missions` via the Supabase dashboard or Staff → Missions UI
2. Set `completion_trigger` to the appropriate enum value
3. Set `is_active = true` and `sort_order` for display ordering
4. If it should be part of a challenge, insert into `challenge_missions`

### Add a new reward

1. Insert into `rewards` via Staff → Rewards UI
2. Set `redemption_method`: use `points` for customer-redeemable, others for auto-awarded
3. Set `points_cost` if `redemption_method = 'points'`

### Add a new event type (e.g., a new recurring game night)

1. Insert into `event_types` (`name`, `slug`, `icon`, `schedule_label`, `participant_type`)
2. Create `events` rows for upcoming dates
3. Add attendance/win missions with `completion_trigger = 'event_attendance'`

### Schedule the event reminder cron

The `/api/push/event-reminder` route sends push notifications 1–3 days before events to users who attended the previous occurrence. Call it daily with the `x-cron-secret` header. Example with Netlify Scheduled Functions:

```toml
# netlify.toml
[[plugins]]
package = "@netlify/plugin-nextjs"

[functions."push-event-reminder"]
schedule = "0 14 * * *"   # 2pm UTC daily
```

<!-- Section updated 2026-04-25: switched menu sync scheduler from Netlify
     scheduled functions (which never executed under @netlify/plugin-nextjs)
     to Supabase pg_cron + pg_net. -->

### Menu sync cron (already wired up)

The Google Sheet → Supabase menu sync runs automatically every day at **08:00 UTC** (2 AM CST / 3 AM CDT — always before the tasting room opens). Implementation:

- **Scheduler:** Supabase **pg_cron** + **pg_net** extensions. The cron job runs inside Postgres and calls the app's existing endpoint over HTTP.
- **Endpoint:** `/api/sync-menu` — accepts either `x-sync-secret` (staff "Sync Menu" button) or `x-cron-secret` (scheduler).
- **Setup script:** `supabase/cron/setup-daily-menu-sync.sql` — one-time runbook with extension enables, cron schedule, verification queries, and an optional Vault hardening section.

To change the schedule, edit the cron expression inside the running Supabase job. Either re-run Section 3 of `supabase/cron/setup-daily-menu-sync.sql` with a new schedule (the script unschedules first), or alter the job in place:

```sql
select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'daily-menu-sync'),
  schedule := '0 8 * * *'
);
```

To monitor execution: `select * from cron.job_run_details order by start_time desc limit 10;`

Required env var: `CRON_SECRET` (also used by the event reminder cron). Set it in Netlify → Site configuration → Environment variables, and embed the same value in the pg_cron command (or store it in Supabase Vault — see the bottom of the setup SQL).

> **Why not Netlify Scheduled Functions?** They were the original implementation but never executed under `@netlify/plugin-nextjs`. The function deployed and showed as "Scheduled" in the UI, but neither cron-triggered runs nor the "Run now" button produced log entries. Supabase pg_cron has worked first try, gives us proper execution history (`cron.job_run_details`) and response capture (`net._http_response`), and keeps the scheduler off Netlify entirely.

### Run a database migration

```bash
# With Supabase CLI
supabase db push

# Or paste the SQL directly into Supabase SQL editor → New query
```

---

## Known Limitations & Future Work

- **Account recovery** — auth is OTP-only. If a customer loses email access, there's no self-service recovery. A staff member can manually update `auth.users` via Supabase dashboard.
- **Rate limiting is in-memory** — `lib/rate-limit.ts` uses a process-local Map. On serverless, each Lambda invocation is isolated, so limits are per-instance rather than global. Fine for a small bar app; upgrade to Upstash Redis if abuse becomes a concern.
- **No Terms of Service** — Privacy Policy exists at `/privacy`; a ToS page could follow the same pattern.
- **Toast sync is manual** — staff triggers it. An automated nightly sync would be a quality-of-life improvement.
