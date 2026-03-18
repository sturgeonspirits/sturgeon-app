# Sturgeon Spirits App — Setup Guide

## Prerequisites
- Node.js 20+
- Supabase project (existing)
- Netlify account (existing)
- Supabase CLI: `npm install -g supabase`

---

## 1. Clone & Install

```bash
git clone https://github.com/your-org/sturgeon-app
cd sturgeon-app
npm install
```

---

## 2. Environment Variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

| Variable | Where to find |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page (keep secret) |
| `QR_HMAC_SECRET` | Run: `openssl rand -hex 32` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Run: `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | Same command |

---

## 3. Run Database Migrations

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Or apply manually in Supabase Dashboard → SQL Editor, in order:
1. `supabase/migrations/001_profiles_auth.sql`
2. `supabase/migrations/002_earn_events.sql`
3. `supabase/migrations/003_missions_challenges.sql`
4. `supabase/migrations/004_event_types_leaderboards.sql`
5. `supabase/migrations/005_rewards.sql`
6. `supabase/migrations/006_tasting_journal.sql`

---

## 4. Generate TypeScript Types (after migrations)

```bash
npm run db:types
```

This regenerates `lib/supabase/database.types.ts` from your live schema.

---

## 5. Create Staff Accounts

Before a staff member can log in:

1. Have them sign up normally (or create via Supabase Auth dashboard)
2. In Supabase Dashboard → Table Editor → `profiles`, find their row
3. Set `role` to `staff` or `admin`

That's it. The middleware will enforce access automatically.

---

## 6. Local Development

```bash
npm run dev
```

Open `http://localhost:3000`

- Consumer app: `/`
- Staff console: `/staff` (requires staff role)
- Auth: `/auth/login`

---

## 7. Deploy to Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Link to your site
netlify link

# Deploy
netlify deploy --build --prod
```

Set all environment variables in Netlify Dashboard → Site settings → Environment variables.

---

## 8. Supabase Auth Email Template

In Supabase Dashboard → Auth → Email Templates → "Magic Link":

Change the template to send a **6-digit OTP code** (not a link):

```
Your Sturgeon Spirits verification code: {{ .Token }}

Valid for 10 minutes. Don't share this with anyone.
```

Set **OTP expiry** to `600` seconds (10 minutes).

---

## 9. Adding New Event Types (no code changes needed)

```sql
INSERT INTO public.event_types
  (name, slug, description, participant_type, scoring_method,
   participation_mission_slug, placement_points, icon, color, day_of_week, typical_time)
VALUES
  ('Darts Night', 'darts', 'Friday night darts', 'individual', 'placement',
   'attend-event', '{"1":200,"2":150,"3":100,"participant":50}',
   '🎯', '#e87c3e', 5, '8:00 PM');
```

The leaderboard page and staff score entry panel pick it up automatically.

---

## 10. Adding New Missions (no code changes needed)

```sql
INSERT INTO public.missions (slug, title, description, icon, points, completion_trigger)
VALUES ('try-seasonal', 'Try the Seasonal', 'Log the seasonal expression', '🍂', 100, 'journal_entry');
```

The Club tab picks it up automatically.

---

## Project Structure

```
sturgeon-app/
├── app/
│   ├── (consumer)/          # Customer PWA — tab bar layout
│   │   ├── club/            # Loyalty home + missions + tier
│   │   ├── leaderboards/    # All-events list + [slug] detail
│   │   ├── journal/         # Tasting log list + /new form
│   │   ├── rewards/         # Rewards catalogue + pending
│   │   └── profile/         # Points history + sign out
│   ├── auth/                # Customer OTP login + verify
│   ├── staff/               # Staff console (role-guarded)
│   └── api/                 # Route handlers
├── components/
│   ├── club/                # MissionCard, TierProgress, QrScanner
│   ├── leaderboard/         # LeaderboardBoard (generic, branches on scoring_method)
│   ├── journal/             # JournalForm
│   ├── staff/               # Score entry forms, MissionPanel
│   └── nav/                 # TabBar
├── lib/
│   ├── supabase/            # client.ts, server.ts, types.ts
│   ├── earn-events.ts       # emitEarnEvent + completeMission (NEVER bypass these)
│   └── utils.ts
└── supabase/
    └── migrations/          # 001–006 SQL files
```
