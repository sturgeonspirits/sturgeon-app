// ─────────────────────────────────────────────
// Changelog
//   v2026-06-03.1 — Individual (cribbage) nights: load signed-up players and
//                   their match reports so registered users can self-report
//                   each of their 3 matches with a running nightly total.
// ─────────────────────────────────────────────
import { redirect } from 'next/navigation'
import { getAuthUser, createServiceClient } from '@/lib/supabase/server'
import EventSignupForm from '@/components/events/EventSignupForm'
import CribbageMatchReport, { type PlayerOption, type MatchReport } from '@/components/events/CribbageMatchReport'
import Link from 'next/link'

interface Props { params: Promise<{ periodId: string }> }

export default async function EventSignupPage({ params }: Props) {
  const { periodId } = await params

  const { user } = await getAuthUser()
  if (!user) redirect('/login')

  const service = createServiceClient()

  // Fetch period + event type (separate queries to avoid relying on PostgREST
  // FK schema cache, which can go stale after DDL changes like enabling RLS)
  const { data: period } = await service
    .from('leaderboard_periods')
    .select('id, label, starts_at, is_finalized, event_type_id, event_id')
    .eq('id', periodId)
    .maybeSingle()

  if (!period) redirect('/events')

  const { data: et } = await service
    .from('event_types')
    .select('name, icon, slug, participant_type')
    .eq('id', period.event_type_id)
    .maybeSingle()
  const participantType = (et?.participant_type ?? 'individual') as 'team' | 'individual'
  const todayChicago = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })

  // Get reliable event date: prefer linked event record, then parse label, then starts_at
  let eventDateStr: string | null = null
  if ((period as any).event_id) {
    const { data: linkedEvent } = await service
      .from('events')
      .select('event_date')
      .eq('id', (period as any).event_id)
      .maybeSingle()
    eventDateStr = linkedEvent?.event_date ?? null
  }
  if (!eventDateStr) {
    const parsed = new Date(period.label)
    if (!isNaN(parsed.getTime())) {
      eventDateStr = parsed.toLocaleDateString('en-CA')
    }
  }
  if (!eventDateStr) {
    eventDateStr = new Date(period.starts_at).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  }

  // Block sign-up for past or finalized events
  if (period.is_finalized || eventDateStr < todayChicago) {
    redirect(`/leaderboards/${et?.slug ?? ''}`)
  }

  // Format display date
  const [y, mo, d] = eventDateStr.split('-').map(Number)
  const eventDate = new Date(y, mo - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  // ── Individual events (e.g. cribbage): check registration + load self-report data ──
  let isRegistered = false
  let players: PlayerOption[] = []
  let matchReports: MatchReport[] = []
  if (participantType === 'individual') {
    // All signed-up players for the night (each has a leaderboard_events row).
    const { data: regRows } = await service
      .from('leaderboard_events')
      .select('user_id')
      .eq('period_id', periodId)

    const playerIds = (regRows ?? []).map((r: any) => r.user_id)
    isRegistered = playerIds.includes(user.id)

    if (playerIds.length > 0) {
      const { data: profs } = await service
        .from('profiles')
        .select('id, display_name, full_name')
        .in('id', playerIds)
      const profMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]))
      players = playerIds.map((id: string) => ({
        id,
        name: profMap[id]?.display_name ?? profMap[id]?.full_name ?? 'Player',
      }))
    }

    const { data: reportRows } = await service
      .from('cribbage_match_reports')
      .select('reporter_id, opponent_id, opponent_name, match_number, won, spread')
      .eq('period_id', periodId)
    matchReports = (reportRows ?? []).map((r: any) => ({
      reporterId:   r.reporter_id,
      opponentId:   r.opponent_id,
      opponentName: r.opponent_name,
      matchNumber:  r.match_number,
      won:          r.won,
      spread:       r.spread ?? 0,
    }))
  }

  // ── Team events (e.g. trivia): load teams ────────────────────────────────────
  let teams: Array<{
    periodTeamId: string | null
    permanentTeamId: string
    name: string
    memberCount: number
    members: string[]
    isMine: boolean
  }> = []
  let myTeam = null

  if (participantType === 'team') {
    // Primary: permanent_teams for this event type
    const { data: permTeams } = await service
      .from('permanent_teams')
      .select('id, name')
      .eq('event_type_id', period.event_type_id)
      .order('name')

    let allKnownTeams: Array<{ id: string; name: string }> = permTeams ?? []

    // Fallback: two-step fetch from leaderboard_teams if permanent_teams is empty
    if (allKnownTeams.length === 0) {
      const { data: allEventPeriods } = await service
        .from('leaderboard_periods')
        .select('id')
        .eq('event_type_id', period.event_type_id)

      const pastPeriodIds = (allEventPeriods ?? []).map((p: any) => p.id)
      if (pastPeriodIds.length > 0) {
        const { data: pastTeams } = await service
          .from('leaderboard_teams')
          .select('permanent_team_id, name')
          .in('period_id', pastPeriodIds)
          .order('name')

        const seenPermIds = new Set<string>()
        const seenNames   = new Set<string>()
        for (const t of (pastTeams ?? [])) {
          if (t.permanent_team_id) {
            if (!seenPermIds.has(t.permanent_team_id)) {
              seenPermIds.add(t.permanent_team_id)
              seenNames.add(t.name.toLowerCase())
              allKnownTeams.push({ id: t.permanent_team_id, name: t.name })
            }
          } else if (!seenNames.has(t.name.toLowerCase())) {
            seenNames.add(t.name.toLowerCase())
            // Use name-prefixed id; create-team-direct will upsert permanent_team on join
            allKnownTeams.push({ id: `name::${t.name}`, name: t.name })
          }
        }
      }
    }

    // Current period team rows (who's already signed up)
    const { data: periodTeams } = await service
      .from('leaderboard_teams')
      .select('id, permanent_team_id, leaderboard_team_members(user_id, profiles(display_name, full_name))')
      .eq('period_id', periodId)

    const periodTeamMap = new Map<string, { periodTeamId: string; members: Array<{ userId: string; name: string }> }>()
    for (const pt of (periodTeams ?? [])) {
      const members = ((pt as any).leaderboard_team_members ?? []).map((m: any) => ({
        userId: m.user_id,
        name: m.profiles?.display_name ?? m.profiles?.full_name ?? 'Member',
      }))
      if ((pt as any).permanent_team_id) {
        periodTeamMap.set((pt as any).permanent_team_id, { periodTeamId: pt.id, members })
      }
    }

    teams = allKnownTeams.map((pt) => {
      const periodInfo = periodTeamMap.get(pt.id)
      const members    = periodInfo?.members ?? []
      const isMine     = members.some(m => m.userId === user.id)
      return {
        periodTeamId:    periodInfo?.periodTeamId ?? null,
        permanentTeamId: pt.id,
        name:            pt.name,
        memberCount:     members.length,
        members:         members.map(m => m.name),
        isMine,
      }
    })

    myTeam = teams.find(t => t.isMine) ?? null
  }

  return (
    <div className="min-h-screen bg-[#F5F2EC]">
      <div className="max-w-lg mx-auto px-4 py-8 pb-28">
        <Link
          href="/events"
          className="inline-flex items-center gap-1.5 text-sm text-[#7E613F] hover:text-[#96321F] transition-colors mb-6"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back to Events
        </Link>

        <EventSignupForm
          periodId={periodId}
          eventName={et?.name ?? 'Event'}
          eventIcon={et?.icon ?? '🃏'}
          eventDate={eventDate}
          participantType={participantType}
          teams={teams}
          myTeam={myTeam}
          isRegistered={isRegistered}
        />

        {/* Self-report match scores — individual events, once signed up */}
        {participantType === 'individual' && isRegistered && (
          <div className="mt-8 pt-6 border-t border-[#D4CFC3]">
            <h2 className="text-lg font-bold text-[#242622] mb-3">Add your match scores</h2>
            {players.length < 2 ? (
              <p className="text-sm text-[#7E613F]">
                Once another player signs up you’ll be able to record your matches here.
              </p>
            ) : (
              <CribbageMatchReport
                periodId={periodId}
                currentUserId={user.id}
                players={players}
                reports={matchReports}
                slug={et?.slug ?? undefined}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
