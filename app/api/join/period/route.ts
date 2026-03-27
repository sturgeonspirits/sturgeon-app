import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/join/period?t=TOKEN
// Returns period info and current teams for the QR join page.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const service = createServiceClient()

  // Find period by join_token, including the linked scheduled event for its date
  const { data: period } = await service
    .from('leaderboard_periods')
    .select('id, label, event_type_id, event_id, is_finalized, event_types(name, slug, icon), events(event_date, start_time)')
    .eq('join_token', token)
    .maybeSingle()

  if (!period) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  if (period.is_finalized) return NextResponse.json({ error: 'This event has ended' }, { status: 410 })

  const et = (period as any).event_types
  const ev = (period as any).events

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

  // Format the event date if available
  let eventDateLabel: string | null = null
  if (ev?.event_date) {
    const [year, month, day] = ev.event_date.split('-').map(Number)
    const d = new Date(year, month - 1, day)
    eventDateLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    if (ev.start_time) {
      const [h, m] = ev.start_time.split(':').map(Number)
      const t = new Date(year, month - 1, day, h, m)
      eventDateLabel += ' · ' + t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }
  }

  return NextResponse.json({
    period: {
      id:              period.id,
      label:           period.label,
      eventTypeName:   et?.name       ?? 'Event',
      eventTypeIcon:   et?.icon       ?? '🎉',
      eventDate:       ev?.event_date ?? null,
      eventDateLabel:  eventDateLabel,
    },
    teams: teamList,
  })
}
