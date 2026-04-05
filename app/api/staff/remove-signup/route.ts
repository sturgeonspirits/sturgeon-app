import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// DELETE /api/staff/remove-signup
// Staff removes a customer's self-sign-up for an event (no-show removal).
// Body: { periodId: string, userId: string }
//
// When the period has an event_id we also look for the user in any other
// period linked to the same event, ensuring removal works even if the
// sign-up landed on a different period row than the one shown in the panel.
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

  // Resolve the full set of period IDs: the supplied one, plus any others
  // linked to the same event (handles cross-period registration mismatches).
  const { data: thisPeriod } = await service
    .from('leaderboard_periods')
    .select('event_id')
    .eq('id', periodId)
    .maybeSingle()

  const periodIds: string[] = [periodId]
  const eventId = (thisPeriod as any)?.event_id as string | null | undefined

  if (eventId) {
    const { data: siblings } = await service
      .from('leaderboard_periods')
      .select('id')
      .eq('event_id', eventId)
      .neq('id', periodId)

    for (const s of (siblings ?? [])) {
      periodIds.push((s as any).id)
    }
  }

  // Remove from leaderboard_team_members across all periods
  const { data: periodTeams } = await service
    .from('leaderboard_teams')
    .select('id')
    .in('period_id', periodIds)

  const teamIds = (periodTeams ?? []).map((t: any) => t.id)
  if (teamIds.length > 0) {
    await service
      .from('leaderboard_team_members')
      .delete()
      .eq('user_id', userId)
      .in('team_id', teamIds)
  }

  // Remove from leaderboard_events across all periods
  await service
    .from('leaderboard_events')
    .delete()
    .in('period_id', periodIds)
    .eq('user_id', userId)

  return NextResponse.json({ ok: true })
}
