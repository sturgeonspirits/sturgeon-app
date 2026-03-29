/**
 * POST /api/staff/period
 * Create a new leaderboard period for an event type.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/staff-auth'

export async function POST(req: NextRequest) {
  const auth = await requireStaff()
  if (auth instanceof Response) return auth

  try {
    const { eventTypeId, label, periodType, startsAt, endsAt, eventId } = await req.json()
    if (!eventTypeId || !label) {
      return NextResponse.json({ error: 'eventTypeId and label required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('leaderboard_periods')
      .insert({
        event_type_id: eventTypeId,
        label,
        period_type:   periodType ?? 'weekly',
        starts_at:     startsAt ?? new Date().toISOString(),
        ends_at:       endsAt ?? null,
        is_finalized:  false,
        ...(eventId ? { event_id: eventId } : {}),
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, period: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 })
  }
}
