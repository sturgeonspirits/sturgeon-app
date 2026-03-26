import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/join/period?t=TOKEN
// Returns period info and current teams for the QR join page.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const service = createServiceClient()

  // Find period by join_token
  const { data: period } = await service
    .from('leaderboard_periods')
    .select('id, label, event_type_id, event_types(name, slug, icon), is_open')
    .eq('join_token', token)
    .maybeSingle()

  if (!period) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  if (!period.is_open) return NextResponse.json({ error: 'This event has ended' }, { status: 410 })

  const et = (period as any).event_types

  // Get current teams and members for this period
  const { data: teams } = await service
    .from('leaderboard_teams')
    .select('id, name, leaderboard_team_members(user_id, profiles(display_name))')
    .eq('period_id', period.id)
    .order('name')

  const teamList = (teams ?? []).map((t: any) => ({
    id:          t.id,
    name:        t.name,
    memberCount: t.leaderboard_team_members?.length ?? 0,
    members:     (t.leaderboard_team_members ?? [])
                   .map((m: any) => m.profiles?.display_name ?? '')
                   .filter(Boolean),
  }))

  return NextResponse.json({
    period: {
      id:              period.id,
      label:           period.label,
      eventTypeName:   et?.name   ?? 'Event',
      eventTypeIcon:   et?.icon   ?? '🎉',
    },
    teams: teamList,
  })
}
