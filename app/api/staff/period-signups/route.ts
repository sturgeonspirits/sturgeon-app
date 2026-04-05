import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/staff/period-signups?periodId=xxx[&eventId=yyy]
//
// When eventId is supplied we look up ALL periods linked to that event and
// aggregate sign-ups across them. This is the key fix for individual events
// (cribbage): the customer's registration may land on a different period row
// than the one the staff selected — e.g. when multiple periods exist for the
// same event, or when the sign-up page auto-created a new period.
//
// Falls back to a plain periodId lookup for team events (trivia) that may not
// have an eventId.
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
  // If eventId is supplied, include every period linked to that event so we
  // catch registrations regardless of which period the customer landed on.
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

  // ── Team sign-ups (trivia etc.) ──────────────────────────────────────────
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

  // ── Individual sign-ups (cribbage etc.) ───────────────────────────────────
  const teamMemberUserIds = new Set(
    teams.flatMap((t: any) => t.members.map((m: any) => m.userId))
  )

  const { data: allEvents } = await service
    .from('leaderboard_events')
    .select('user_id, score, wins, losses, profiles(display_name, full_name)')
    .in('period_id', periodIds)

  // Deduplicate by user_id in case someone appears in multiple periods
  const seenUsers = new Set<string>()
  const individuals = (allEvents ?? [])
    .filter((e: any) =>
      !teamMemberUserIds.has(e.user_id) &&
      e.score === 0 &&
      (e.wins ?? 0) === 0 &&
      (e.losses ?? 0) === 0
    )
    .filter((e: any) => {
      if (seenUsers.has(e.user_id)) return false
      seenUsers.add(e.user_id)
      return true
    })
    .map((e: any) => ({
      userId: e.user_id,
      name:   e.profiles?.display_name ?? e.profiles?.full_name ?? 'Member',
    }))

  return NextResponse.json({ teams, individuals })
}
