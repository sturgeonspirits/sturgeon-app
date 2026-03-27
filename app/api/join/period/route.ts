import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/join/period?t=TOKEN
// Returns period info and ALL permanent teams for this event type.
// Teams from previous weeks are included so players can re-join their usual team.
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

  // ── Load ALL permanent teams for this event type (persists across weeks) ──
  const { data: permanentTeams } = await service
    .from('permanent_teams')
    .select('id, name')
    .eq('event_type_id', period.event_type_id)
    .order('name')

  // ── Load this period's membership so we can show who's already in ─────────
  const { data: periodTeams } = await service
    .from('leaderboard_teams')
    .select('permanent_team_id, leaderboard_team_members(user_id, profiles(display_name))')
    .eq('period_id', period.id)

  // Map permanent_team_id → this period's members
  const memberMap = new Map(
    (periodTeams ?? []).map((t: any) => [t.permanent_team_id, t.leaderboard_team_members ?? []])
  )

  const teamList = (permanentTeams ?? []).map((pt: any) => {
    const members: any[] = memberMap.get(pt.id) ?? []
    return {
      id:          pt.id,   // permanent_team_id — used as the join handle
      name:        pt.name,
      memberCount: members.length,
      members:     members
                     .map((m: any) => m.profiles?.display_name ?? '')
                     .filter(Boolean),
    }
  })

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
