import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/staff/period-signups?periodId=xxx
// Returns sign-ups for a period — team members (trivia) and individual
// registrants (cribbage) — so staff can see who's planning to attend.
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
  if (!periodId) return NextResponse.json({ error: 'Missing periodId' }, { status: 400 })

  // ── Team sign-ups (trivia etc.) ──────────────────────────────────────────
  const { data: periodTeams } = await service
    .from('leaderboard_teams')
    .select('id, name, leaderboard_team_members(user_id, profiles(display_name, full_name))')
    .eq('period_id', periodId)
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
  // These are leaderboard_events rows with score=0 and no team membership.
  const teamMemberUserIds = new Set(
    teams.flatMap((t: any) => t.members.map((m: any) => m.userId))
  )

  const { data: allEvents } = await service
    .from('leaderboard_events')
    .select('user_id, score, wins, losses, profiles(display_name, full_name)')
    .eq('period_id', periodId)

  // Individual registrants: in leaderboard_events but NOT in any team
  const individuals = (allEvents ?? [])
    .filter((e: any) => !teamMemberUserIds.has(e.user_id) && e.score === 0 && (e.wins ?? 0) === 0 && (e.losses ?? 0) === 0)
    .map((e: any) => ({
      userId: e.user_id,
      name:   (e as any).profiles?.display_name ?? (e as any).profiles?.full_name ?? 'Member',
    }))

  return NextResponse.json({ teams, individuals })
}
