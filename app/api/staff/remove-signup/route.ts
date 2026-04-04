import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// DELETE /api/staff/remove-signup
// Staff removes a customer's self-sign-up for an event (no-show removal).
// Body: { periodId: string, userId: string }
export async function DELETE(req: NextRequest) {
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

  const { periodId, userId } = await req.json()
  if (!periodId || !userId) {
    return NextResponse.json({ error: 'Missing periodId or userId' }, { status: 400 })
  }

  // Get all team IDs for this period
  const { data: periodTeams } = await service
    .from('leaderboard_teams')
    .select('id')
    .eq('period_id', periodId)

  const teamIds = (periodTeams ?? []).map((t: any) => t.id)

  // Remove from leaderboard_team_members
  if (teamIds.length > 0) {
    await service
      .from('leaderboard_team_members')
      .delete()
      .eq('user_id', userId)
      .in('team_id', teamIds)
  }

  // Remove from leaderboard_events
  await service
    .from('leaderboard_events')
    .delete()
    .eq('period_id', periodId)
    .eq('user_id', userId)

  return NextResponse.json({ ok: true })
}
