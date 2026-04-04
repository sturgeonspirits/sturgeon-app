import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// DELETE /api/join/leave
// Customer removes themselves from a team for a period.
// Body: { periodId: string }
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { periodId } = await req.json()
  if (!periodId) return NextResponse.json({ error: 'Missing periodId' }, { status: 400 })

  const service = createServiceClient()

  // Validate period is not finalized
  const { data: period } = await service
    .from('leaderboard_periods')
    .select('id, is_finalized')
    .eq('id', periodId)
    .maybeSingle()

  if (!period) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  if (period.is_finalized) return NextResponse.json({ error: 'Cannot leave a finalized event' }, { status: 410 })

  // Find user's team for this period
  const { data: periodTeams } = await service
    .from('leaderboard_teams')
    .select('id')
    .eq('period_id', periodId)

  const teamIds = (periodTeams ?? []).map((t: any) => t.id)
  if (teamIds.length === 0) return NextResponse.json({ ok: true }) // nothing to remove

  // Remove from leaderboard_team_members
  if (teamIds.length > 0) {
    await service
      .from('leaderboard_team_members')
      .delete()
      .eq('user_id', user.id)
      .in('team_id', teamIds)
  }

  // Remove from leaderboard_events
  await service
    .from('leaderboard_events')
    .delete()
    .eq('period_id', periodId)
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
