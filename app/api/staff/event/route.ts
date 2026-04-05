import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

// POST  /api/staff/event  — schedule a specific event date
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || !['staff', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { eventTypeId, eventDate, startTime, notes } = body

  if (!eventTypeId || !eventDate) {
    return NextResponse.json({ error: 'eventTypeId and eventDate are required' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('events')
    .insert({
      event_type_id: eventTypeId,
      event_date: eventDate,          // 'YYYY-MM-DD'
      start_time: startTime ?? null,  // 'HH:MM'
      notes: notes ?? null,
      is_cancelled: false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-create a leaderboard period so customers can sign up immediately.
  // starts_at is noon Chicago time on the event date so timezone date matching works.
  const [year, month, day] = eventDate.split('-').map(Number)
  const label = new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
  // Build a noon-Chicago ISO string for starts_at
  const chicagoNoon = new Date(`${eventDate}T12:00:00`)
  const offsetMs    = new Date(chicagoNoon.toLocaleString('en-US', { timeZone: 'America/Chicago' })).getTime()
                    - new Date(chicagoNoon.toLocaleString('en-US', { timeZone: 'UTC' })).getTime()
  const startsAt    = new Date(chicagoNoon.getTime() - offsetMs).toISOString()

  // Upsert so duplicate calls (or existing periods) don't silently fail.
  // Conflict on event_id keeps the existing period untouched.
  const { data: periodData, error: periodError } = await service
    .from('leaderboard_periods')
    .upsert(
      {
        event_type_id: eventTypeId,
        event_id:      data.id,
        label,
        period_type:   'single_night',
        starts_at:     startsAt,
        is_finalized:  false,
      },
      { onConflict: 'event_id', ignoreDuplicates: true }
    )
    .select('id')
    .maybeSingle()

  if (periodError) {
    console.error('[staff/event] Period upsert failed:', periodError.message)
  }

  return NextResponse.json({ event: data, periodId: periodData?.id ?? null })
}

// DELETE /api/staff/event?id=xxx — cancel/remove a specific event date
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || !['staff', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const service = createServiceClient()
  const { error } = await service.from('events').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
