import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/staff/period-signups?periodId=xxx
// Returns all teams + members signed up for a given period.
// Used by staff to view and manage self-sign-ups before event starts.
export async function GET(req: NextRequest) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const service = createServiceClient()

  // Verify staff role
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

  // Fetch teams + members for this period
  const { data: periodTeams, error } = await service
    .from('leaderboard_teams')
    .select('id, name, leaderboard_team_members(user_id, profiles(display_name, full_name))')
    .eq('period_id', periodId)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const teams = (periodTeams ?? [])
    .map((t: any) => ({
      teamId: t.id,
      name:   t.name,
      members: (t.leaderboard_team_members ?? []).map((m: any) => ({
        userId: m.user_id,
        name:   m.profiles?.display_name ?? m.profiles?.full_name ?? 'Member',
      })),
    }))
    .filter((t: any) => t.members.length > 0) // only show teams with at least one sign-up

  return NextResponse.json({ teams })
}
