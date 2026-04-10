import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/staff/period-signups?periodId=xxx[&eventId=yyy]
//
// When eventId is supplied we aggregate sign-ups across ALL periods linked to
// that event so we catch registrations regardless of which period row the
// customer's sign-up landed on.
export async function GET(req: NextRequest) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const service = createServiceClient()

  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !['staff', 'admin'].includes(profile.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const periodId = searchParams.get('periodId')
  const eventId  = searchParams.get('eventId')

  if (!periodId && !eventId) {
    return NextResponse.json({ error: 'Missing periodId or eventId' }, { status: 400 })
  }

  // ── Resolve the full set of period IDs to query ──────────────────────────
  const periodIds: string[] = periodId ? [periodId] : []

  if (eventId) {
    const { data: linkedPeriods } = await service
      .from('leaderboard_periods')
      .select('id')
      .eq('event_id', eventId)

    const seen = new Set(periodIds)
    for (const p of (linkedPeriods ?? [])) {
      if (!seen.has((p as any).id)) { seen.add((p as any).id); periodIds.push((p as any).id) }
    }
  }

  if (periodIds.length === 0) {
    return NextResponse.json({ teams: [], individuals: [] })
  }

  // ── Team sign-ups ────────────────────────────────────────────────────────
  const { data: periodTeams } = await service
    .from('leaderboard_teams')
    .select('id, name, leaderboard_team_members(user_id, profiles(display_name, full_name))')
    .in('period_id', periodIds)
    .order('name')

  const teams = (periodTeams ?? [])
    .map((t: any) => ({
      teamId:  t.id,
      name:    t.name,
      members: (t.leaderboard_team_members ?? []).map((m: any) => ({
        userId: m.user_id,
        name:   m.profiles?.display_name ?? m.profiles?.full_name ?? 'Member',
      })),
    }))
    .filter((t: any) => t.members.length > 0)

  const teamMemberUserIds = new Set(
    teams.flatMap((t: any) => t.members.map((m: any) => m.userId))
  )

  // ── Individual sign-ups (include score state) ────────────────────────────
  // NOTE: Do NOT use an embedded profiles join here — leaderboard_events may
  // not have a PostgREST FK to profiles, which would silently return null for
  // the entire query. Fetch events first, then look up profiles separately.
  const { data: rawEvents, error: eventsError } = await service
    .from('leaderboard_events')
    .select('user_id, score, wins, losses, entered_at, entered_by')
    .in('period_id', periodIds)

  if (eventsError) {
    console.error('[period-signups] leaderboard_events error:', eventsError.message)
  }

  // Return ALL individual sign-ups (not already on a team), dedupe by user.
  // Include score state so staff can see who has scores entered and avoid duplicates.
  const seenUsers = new Set<string>()
  const individualRows = (rawEvents ?? [])
    .filter((e: any) => {
      if (teamMemberUserIds.has(e.user_id)) return false
      if (seenUsers.has(e.user_id)) return false
      seenUsers.add(e.user_id)
      return true
    })

  const individualUserIds = individualRows.map((e: any) => e.user_id as string)

  // Fetch profiles separately to avoid the embedded-join FK problem
  let profileMap: Record<string, string> = {}
  if (individualUserIds.length > 0) {
    const { data: profileRows } = await service
      .from('profiles')
      .select('id, display_name, full_name')
      .in('id', individualUserIds)

    for (const p of (profileRows ?? [])) {
      profileMap[(p as any).id] = (p as any).display_name ?? (p as any).full_name ?? 'Member'
    }
  }

  const individuals = individualRows.map((e: any) => {
    const wins   = e.wins ?? 0
    const losses = e.losses ?? 0
    const score  = e.score ?? 0
    const hasScores = wins > 0 || losses > 0 || score !== 0
    return {
      userId:     e.user_id as string,
      name:       profileMap[e.user_id] ?? 'Member',
      wins,
      losses,
      spread:     score,   // for wins_losses the "score" column stores the spread
      score,               // for points-based events this is the raw score
      hasScores,
      enteredAt:  e.entered_at ?? null,
    }
  })

  return NextResponse.json({ teams, individuals })
}
