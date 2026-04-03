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

  // Fetch all finalized + open periods for this event, newest first
  const { data: periods } = await service
    .from('leaderboard_periods')
    .select('*')
    .eq('event_type_id', eventType.id)
    .order('starts_at', { ascending: false })
    .limit(20)

  const allPeriods  = periods ?? []
  // Which period to display: URL param → most recent
  const currentPeriod = (periodParam
    ? allPeriods.find(p => p.id === periodParam)
    : null) ?? allPeriods[0] ?? null

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

      if (entryData && entryData.length > 0) {
        const userIds = entryData.map((e: any) => e.user_id)
        const { data: profileData } = await service
          .from('profiles')
          .select('id, display_name, avatar_url, tier')
          .in('id', userIds)

        const profileMap = Object.fromEntries((profileData ?? []).map((p: any) => [p.id, p]))
        entries = entryData.map((e: any) => ({
          ...e,
          profiles: profileMap[e.user_id] ?? null,
        }))
      } else {
        entries = entryData ?? []
      }
    }
  }

  const { data: { user } } = await supabase.auth.getUser()

  // ── Check if user is already on a team for the current open period ─────────
  let openPeriodId:      string | null = null
  let userCurrentTeamId: string | null = null

  if (
    user &&
    currentPeriod &&
    !currentPeriod.is_finalized &&
    eventType.participant_type === 'team' &&
    teams.length >= 0
  ) {
    openPeriodId = currentPeriod.id
    const periodTeamIds = teams.map((t: any) => t.id)
    if (periodTeamIds.length > 0) {
      const { data: membership } = await service
        .from('leaderboard_team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .in('team_id', periodTeamIds)
        .maybeSingle()
      userCurrentTeamId = membership?.team_id ?? null
    }
  }

  // All-time cache — two-step fetch, sort by the right metric for this event type
  const allTimeSortCol = eventType.scoring_method === 'wins_losses' ? 'total_wins' : 'total_score'
  const { data: allTimeRaw } = await service
    .from('leaderboard_cache')
    .select('*')
    .eq('event_type_id', eventType.id)
    .order(allTimeSortCol, { ascending: false })
    .limit(20)

  let allTime: any[] = []
  if (allTimeRaw && allTimeRaw.length > 0) {
    const atUserIds = allTimeRaw.map((r: any) => r.user_id)
    const { data: atProfiles } = await service
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', atUserIds)
    const atProfileMap = Object.fromEntries((atProfiles ?? []).map((p: any) => [p.id, p]))
    allTime = allTimeRaw.map((r: any) => ({ ...r, profiles: atProfileMap[r.user_id] ?? null }))
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
