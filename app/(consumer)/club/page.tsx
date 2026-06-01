// ─────────────────────────────────────────────
// Changelog
//   v2026-04-25.1 — Added HoursBanner(s) at top of /club for live "Open now"
//                   status. Sources from distillery_hours table.
//   v2026-04-25.2 — Moved HoursBanner(s) up into the hero card, between the
//                   "Spearers Club" brand header and the "Welcome back" greeting.
//   v2026-04-25.3 — Moved HoursBanner(s) all the way to the top, above
//                   "Sturgeon Spirits / Spearers Club" brand header.
// ─────────────────────────────────────────────

import { getAuthUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TierProgress from '@/components/club/TierProgress'
import MissionGrid from '@/components/club/MissionGrid'
import ShopMenu from '@/components/club/ShopMenu'
import HoursBanner from '@/components/club/HoursBanner'
import type { HoursRow } from '@/lib/hours'
import {
  CocktailGlass,
  PenNib,
  Podium,
  Medal,
  DiamondSuit,
  Spear,
  GlassesTouch,
} from '@/components/icons/brand'

export default async function ClubPage() {
  const { supabase, user } = await getAuthUser()
  if (!user) redirect('/auth/login')

  // Redirect to onboarding if profile hasn't been completed yet
  const { data: profileCheck, error: profileCheckError } = await supabase
    .from('profiles').select('full_name').eq('id', user.id).maybeSingle()
  // Only redirect if we got a clean response and full_name is genuinely missing
  if (!profileCheckError && profileCheck !== null && !profileCheck?.full_name) {
    redirect('/onboarding')
  }

  const [profileRes, ledgerRes, missionsRes, completionsRes, challengesRes, pendingRequestsRes, { data: tiers }, hoursRes] = await Promise.all([
    supabase.from('profiles').select('display_name, tier, full_name').eq('id', user.id).single(),
    supabase.from('points_ledger').select('balance, lifetime_earned, lifetime_spent').eq('user_id', user.id).maybeSingle(),
    supabase.from('missions').select('id, title, description, icon, points, slug, sort_order, completion_trigger, is_repeatable, is_active, repeat_limit, repeat_cooldown_days, min_tier, metadata, created_at').eq('is_active', true).order('sort_order'),
    supabase.from('mission_completions').select('mission_id').eq('user_id', user.id),
    supabase.from('challenges').select('id, title, description, icon, bonus_points, sort_order, challenge_missions(mission_id)').eq('is_active', true).order('sort_order'),
    supabase.from('mission_completion_requests').select('mission_id').eq('user_id', user.id).eq('status', 'pending'),
    supabase.from('tier_thresholds').select('*').order('min_lifetime'),
    // Hours: pull all rows for every location, then group below.
    supabase.from('distillery_hours').select('*').order('sort_order'),
  ])

  // Group hours rows by location, with primary location(s) first.
  const allHoursRows = ((hoursRes?.data ?? []) as HoursRow[])
  const hoursByLocation = new Map<string, HoursRow[]>()
  for (const r of allHoursRows) {
    const list = hoursByLocation.get(r.location) ?? []
    list.push(r)
    hoursByLocation.set(r.location, list)
  }
  // Sort locations: primary first, then alphabetical.
  const sortedLocations = Array.from(hoursByLocation.keys()).sort((a, b) => {
    const aPrimary = (hoursByLocation.get(a) ?? []).some(r => r.is_primary)
    const bPrimary = (hoursByLocation.get(b) ?? []).some(r => r.is_primary)
    if (aPrimary !== bPrimary) return aPrimary ? -1 : 1
    return a.localeCompare(b)
  })

  const profile     = profileRes.data
  const ledger      = ledgerRes.data
  const missions    = missionsRes.data ?? []
  const completions = completionsRes.data ?? []
  const challenges  = challengesRes.data ?? []
  const completedIds   = new Set(completions.map(c => c.mission_id))
  const pendingRequestIds = new Set((pendingRequestsRes.data ?? []).map((r: any) => r.mission_id))

  const firstName = profile?.display_name?.split(' ')[0] ?? null
  const balance   = ledger?.balance ?? 0
  const tier      = profile?.tier ?? 'newcomer'

  const TIER_COLOR: Record<string, string> = {
    newcomer:  '#7a6e5f',   // warm muted
    regular:   '#87A67F',   // brand olive
    spearer:   '#C8BCA4',   // brand tan
    harpooner: '#7E613F',   // brand brown
    captain:   '#96321F',   // brand rust
  }
  const TIER_LABEL: Record<string, string> = {
    newcomer:  'Fingerling',
    regular:   'Shanty',
    spearer:   'Spearer',
    harpooner: 'Harpooner',
    captain:   'Captain',
  }
  const tierColor = TIER_COLOR[tier] ?? '#888'
  const tierLabel = TIER_LABEL[tier] ?? tier

  return (
    <div className="max-w-lg mx-auto">
      {/* ── Hero membership card ─────────────────────────── */}
      <div className="relative overflow-hidden px-4 pt-12 pb-8">
        {/* Ambient glow behind card */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${tierColor}18 0%, transparent 70%)`,
          }}
        />

        <div className="relative">
          {/* Hours banner(s) — top of the hero, above the brand header */}
          {sortedLocations.length > 0 && (
            <div className="space-y-2 mb-5">
              {sortedLocations.map(loc => (
                <HoursBanner key={loc} location={loc} rows={hoursByLocation.get(loc) ?? []} />
              ))}
            </div>
          )}

          {/* Brand header */}
          <div className="mb-4">
            <p className="text-[10px] font-semibold text-[#9E8F7E] uppercase tracking-[0.25em]">
              Sturgeon Spirits
            </p>
            <p className="font-display text-lg font-bold text-[#242622] leading-tight">
              Spearers Club
            </p>
          </div>

          {/* Greeting */}
          <p className="text-xs text-[#7E613F] uppercase tracking-[0.18em] mb-0.5">
            {firstName ? 'Welcome back,' : 'Welcome'}
          </p>
          <h1 className="font-display text-2xl font-bold text-[#242622] leading-tight">
            {firstName ?? 'Member'}
          </h1>

          {/* Points + tier pill */}
          <div className="flex items-end gap-3 mt-4">
            <div>
              <p className="text-4xl font-bold tabular-nums" style={{ color: tierColor }}>
                {balance.toLocaleString()}
              </p>
              <p className="text-xs text-[#7E613F] mt-0.5">points balance</p>
            </div>
            <div className="mb-1.5">
              <span
                className="inline-block text-xs font-semibold px-3 py-1 rounded-full border"
                style={{ color: tierColor, borderColor: `${tierColor}50`, background: `${tierColor}15` }}
              >
                {tierLabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-6 pb-6">
        {/* Tier progress */}
        {tiers && profile && ledger && (
          <TierProgress
            currentTier={profile.tier}
            lifetimeEarned={ledger.lifetime_earned}
            tiers={tiers}
          />
        )}

        {/* Quick access grid */}
        <section>
          <SectionHeader label="Explore" />
          <div className="grid grid-cols-2 gap-2">
            {([
              { href: '/menu',         Icon: CocktailGlass, label: 'Cocktail Menu',   desc: 'Browse our drinks'         },
              { href: '/journal',      Icon: PenNib,        label: 'Tasting Journal', desc: 'Log + earn points'         },
              { href: '/leaderboards', Icon: Podium,        label: 'Standings',       desc: 'Weekly leaderboards'       },
              { href: '/rewards',      Icon: Medal,         label: 'Rewards',         desc: 'Redeem your points'        },
              { href: '/events',       Icon: DiamondSuit,   label: 'Events',          desc: "What's on this week"       },
              { href: '/checkin/scan', Icon: Spear,         label: 'Check In',        desc: 'Scan QR at the distillery' },
            ] as const).map(item => (
              <Link
                key={item.label}
                href={item.href}
                className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-4 flex flex-col gap-2 hover:border-[#C8BCA4] active:scale-[0.98] transition-all"
              >
                <item.Icon size={26} className="text-[#7E613F]" />
                <div>
                  <p className="text-sm font-semibold text-[#242622]">{item.label}</p>
                  <p className="text-xs text-[#7E613F] mt-0.5">{item.desc}</p>
                </div>
              </Link>
            ))}

            {/* Shop — opens bottom sheet with multiple destinations */}
            <ShopMenu />

            {/* Book a Private Event */}
            <a
              href="https://sturgeonspirits.com/private-events"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-4 flex flex-col gap-2 hover:border-[#C8BCA4] active:scale-[0.98] transition-all"
            >
              <GlassesTouch size={26} className="text-[#7E613F]" />
              <div>
                <p className="text-sm font-semibold text-[#242622]">Book an Event</p>
                <p className="text-xs text-[#7E613F] mt-0.5">Private tastings & parties</p>
              </div>
            </a>
          </div>
        </section>

        {/* Challenges */}
        {challenges.length > 0 && (
          <section>
            <SectionHeader label="Challenges" />
            <div className="space-y-2">
              {challenges.map(challenge => {
                const required = (challenge.challenge_missions as { mission_id: string }[]) ?? []
                const done     = required.filter(cm => completedIds.has(cm.mission_id)).length
                const pct      = required.length ? Math.round((done / required.length) * 100) : 0
                return (
                  <div key={challenge.id} className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{challenge.icon}</span>
                        <div>
                          <p className="text-sm font-semibold text-[#242622]">{challenge.title}</p>
                          <p className="text-xs text-[#7E613F] mt-0.5">{challenge.description}</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-[#96321F] shrink-0 ml-2">
                        +{challenge.bonus_points} pts
                      </span>
                    </div>
                    <div className="h-1 bg-[#E8E4D6] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: '#96321F' }}
                      />
                    </div>
                    <p className="text-xs text-[#9E8F7E] mt-1.5">{done}/{required.length} missions</p>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Missions */}
        <section>
          <SectionHeader label="Missions" />
          <MissionGrid missions={missions} completedIds={completedIds} pendingRequestIds={pendingRequestIds} userId={user.id} />
        </section>
      </div>
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <p className="text-xs font-semibold text-[#7E613F] uppercase tracking-[0.18em]">{label}</p>
      <div className="flex-1 h-px bg-[#D4CFC3]" />
    </div>
  )
}
