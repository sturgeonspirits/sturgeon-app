import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import LeaderboardBoard from '@/components/leaderboard/LeaderboardBoard'

interface Props {
  params:      Promise<{ slug: string }>
  searchParams: Promise<{ period?: string }>
}

export default async function LeaderboardDetailPage({ params, searchParams }: Props) {
  const { slug }     = await params
  const { period: periodParam } = await searchParams
  const supabase     = await createClient()
  const service      = createServiceClient()

  // Fetch event type config — drives all board behaviour
  const { data: eventType } = await service
    .from('event_types')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!eventType) notFound()

  // Only single_night periods — weekly/monthly/season periods are not used.
  // Fetch newest 20 first, then re-sort ascending (earliest-leftmost) for display.
  const { data: periods } = await service
    .from('leaderboard_periods')
    .select('*')
    .eq('event_type_id', eventType.id)
    .eq('period_type', 'single_night')
    .order('starts_at', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(20)

  const rawPeriods = periods ?? []

  // Deduplicate same-date periods (accidental duplicates).
  // Priority: finalized > has join_token (staff set it up properly) > first created.
  const dedupedPeriods: typeof rawPeriods = (() => {
    const seen = new Map<string, (typeof rawPeriods)[0]>()
    for (const p of rawPeriods) {
      const dateKey = p.starts_at
        ? new Date(p.starts_at).toISOString().slice(0, 10)
        : p.label
      const existing = seen.get(dateKey)
      if (!existing) {
        seen.set(dateKey, p)
        continue
      }
      const pScore    = (p.is_finalized ? 2 : 0)         + ((p as any).join_token ? 1 : 0)
      const exScore   = (existing.is_finalized ? 2 : 0)  + ((existing as any).join_token ? 1 : 0)
      if (pScore > exScore) seen.set(dateKey, p)
    }
    return Array.from(seen.values())
  })()

  // Display order: earliest date on the LEFT (ascending by starts_at).
  const allPeriods = [...dedupedPeriods].sort((a, b) => {
    const ad = a.starts_at ?? ''
    const bd = b.starts_at ?? ''
    return ad.localeCompare(bd)
  })

  // Which period to display: URL param → most recent (last in ascending list).
  const currentPeriod = (periodParam
    ? allPeriods.find((p: any) => p.id === periodParam)
    : null) ?? allPeriods[allPeriods.length - 1] ?? null

  // Fetch scores for the selected period
  let entries: any[] = []
  let teams:   any[] = []

  if (currentPeriod) {
    if (eventType.participant_type === 'team') {
      const { data: teamData } = await service
        .from('leaderboard_teams')
        .select('*')
        .eq('period_id', currentPeriod.id)
        .order('placement')

      if (teamData && teamData.length > 0) {
        const { data: memberData } = await service
          .from('leaderboard_team_members')
          .select('*')
          .in('team_id', teamData.map((t: any) => t.id))

        const memberUserIds = [...new Set((memberData ?? []).map((m: any) => m.user_id))]
        const { data: memberProfiles } = memberUserIds.length > 0
          ? await service.from('profiles').select('id, display_name, avatar_url').in('id', memberUserIds)
          : { data: [] }

        const profileMap    = Object.fromEntries((memberProfiles ?? []).map((p: any) => [p.id, p]))
        const membersByTeam: Record<string, any[]> = {}
        for (const m of memberData ?? []) {
          if (!membersByTeam[m.team_id]) membersByTeam[m.team_id] = []
          membersByTeam[m.team_id].push({ ...m, profiles: profileMap[m.user_id] ?? null })
        }
        teams = teamData.map((t: any) => ({
          ...t,
          leaderboard_team_members: membersByTeam[t.id] ?? [],
        }))
      } else {
        teams = teamData ?? []
      }
    } else {
      // Two-step: entries then profiles — avoids PostgREST FK cache issues
      const { data: entryData } = await service
        .from('leaderboard_events')
        .select('*')
        .eq('period_id', currentPeriod.id)
        .order(
          eventType.scoring_method === 'wins_losses' ? 'wins' : 'score',
          { ascending: false }
        )

      // Hide pure sign-ups (no scores entered yet): wins=0 AND losses=0 AND score=0
      const scoredRows = (entryData ?? []).filter((e: any) =>
        (e.wins ?? 0) > 0 || (e.losses ?? 0) > 0 || (e.score ?? 0) !== 0
      )

      if (scoredRows.length > 0) {
        const userIds = scoredRows.map((e: any) => e.user_id)
        const { data: profileData } = await service
          .from('profiles')
          .select('id, display_name, avatar_url, tier')
          .in('id', userIds)

        const profileMap = Object.fromEntries((profileData ?? []).map((p: any) => [p.id, p]))
        entries = scoredRows.map((e: any) => ({
          ...e,
          profiles: profileMap[e.user_id] ?? null,
        }))
      } else {
        entries = []
      }
    }
  }

  const { data: { user } } = await supabase.auth.getUser()

  // ── Check if user is already on a team for the current open period ─────────
  let openPeriodId:      string | null = null
  let userCurrentTeamId: string | null = null

  // Only offer in-app joining on the same calendar day as the event or in the
  // future. Once the date has passed (America/Chicago), no join UI appears —
  // even if the period was never formally finalized.
  const todayChicago = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }) // YYYY-MM-DD
  const periodDateChicago = currentPeriod?.starts_at
    ? new Date(currentPeriod.starts_at).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
    : null
  const periodIsCurrentOrFuture = !!periodDateChicago && periodDateChicago >= todayChicago

  if (
    user &&
    currentPeriod &&
    !currentPeriod.is_finalized &&
    periodIsCurrentOrFuture &&
    eventType.participant_type === 'team' &&
    teams.length >= 0
  ) {
    openPeriodId = currentPeriod.id

    // If no teams have signed up yet, load permanent teams so the join UI has options
    if (teams.length === 0) {
      const { data: permTeams } = await service
        .from('permanent_teams')
        .select('id, name')
        .eq('event_type_id', eventType.id)
        .order('name')

      teams = (permTeams ?? []).map((pt: any) => ({
        id:                       null,          // no period team row yet
        permanent_team_id:        pt.id,
        name:                     pt.name,
        score:                    0,
        placement:                0,
        leaderboard_team_members: [],
      }))
    }

    const periodTeamIds = teams.filter((t: any) => t.id).map((t: any) => t.id)
    if (periodTeamIds.length > 0) {
      const { data: membership } = await service
        .from('leaderboard_team_members')
        .select('team_id, leaderboard_teams(permanent_team_id)')
        .eq('user_id', user.id)
        .in('team_id', periodTeamIds)
        .maybeSingle()
      // Track by permanent_team_id so it matches team entries that may have id:null
      userCurrentTeamId = (membership as any)?.leaderboard_teams?.permanent_team_id ?? null
    }
  }

  // All-time standings — computed on the fly from every leaderboard_events row
  // tied to any period for this event type. Aggregates wins, losses, spread /
  // total score, and counts distinct periods actually participated in (scored).
  let allTime: any[] = []
  {
    // 1. every period for this event type
    const { data: allPeriodRows } = await service
      .from('leaderboard_periods')
      .select('id')
      .eq('event_type_id', eventType.id)

    const allPeriodIds = (allPeriodRows ?? []).map((p: any) => p.id)

    if (allPeriodIds.length > 0) {
      // 2. every scored row across all those periods
      const { data: allEvents } = await service
        .from('leaderboard_events')
        .select('user_id, period_id, score, wins, losses')
        .in('period_id', allPeriodIds)

      type Agg = {
        user_id: string
        total_wins: number
        total_losses: number
        total_score: number   // spread for wins_losses, points for points-based
        events_attended: number
        periods: Set<string>
      }
      const byUser = new Map<string, Agg>()

      for (const e of (allEvents ?? [])) {
        const wins   = (e as any).wins   ?? 0
        const losses = (e as any).losses ?? 0
        const score  = (e as any).score  ?? 0
        // Skip pure sign-ups (no scores entered) — don't count as participation
        if (wins === 0 && losses === 0 && score === 0) continue

        const uid = (e as any).user_id as string
        let agg = byUser.get(uid)
        if (!agg) {
          agg = {
            user_id: uid,
            total_wins: 0,
            total_losses: 0,
            total_score: 0,
            events_attended: 0,
            periods: new Set(),
          }
          byUser.set(uid, agg)
        }
        agg.total_wins   += wins
        agg.total_losses += losses
        agg.total_score  += score
        agg.periods.add((e as any).period_id)
      }

      const rows = Array.from(byUser.values()).map(a => ({
        user_id:         a.user_id,
        event_type_id:   eventType.id,
        total_wins:      a.total_wins,
        total_losses:    a.total_losses,
        total_score:     a.total_score,
        events_attended: a.periods.size,
      }))

      const sortCol: 'total_wins' | 'total_score' =
        eventType.scoring_method === 'wins_losses' ? 'total_wins' : 'total_score'

      rows.sort((a, b) => {
        const primary = (b[sortCol] as number) - (a[sortCol] as number)
        if (primary !== 0) return primary
        // Tie-breakers: more events attended, then higher spread/score
        if (b.events_attended !== a.events_attended) {
          return b.events_attended - a.events_attended
        }
        return b.total_score - a.total_score
      })

      const topRows = rows.slice(0, 20)

      if (topRows.length > 0) {
        const atUserIds = topRows.map(r => r.user_id)
        const { data: atProfiles } = await service
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', atUserIds)
        const atProfileMap = Object.fromEntries((atProfiles ?? []).map((p: any) => [p.id, p]))
        allTime = topRows.map(r => ({ ...r, profiles: atProfileMap[r.user_id] ?? null }))
      }
    }
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="pt-4">
        <a href="/leaderboards" className="text-sm text-[#7E613F] hover:text-[#96321F] mb-3 inline-block transition-colors">
          ← Standings
        </a>
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
            style={{ backgroundColor: `${eventType.color ?? '#96321F'}20`, border: `1px solid ${eventType.color ?? '#96321F'}40` }}
          >
            {eventType.icon}
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#242622]">{eventType.name}</h1>
            <p className="text-sm text-[#7E613F]">{eventType.description}</p>
          </div>
        </div>
      </div>

      <LeaderboardBoard
        eventType={eventType}
        currentPeriod={currentPeriod}
        periods={allPeriods}
        entries={entries}
        teams={teams}
        allTime={allTime}
        currentUserId={user?.id}
        slug={slug}
        openPeriodId={openPeriodId}
        userCurrentTeamId={userCurrentTeamId}
      />
    </div>
  )
}
