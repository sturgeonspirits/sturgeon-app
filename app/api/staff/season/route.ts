/**
 * GET  /api/staff/season?eventTypeId=xxx  — get current season for an event type
 * POST /api/staff/season  { eventTypeId, label }  — start a new season
 *
 * A "season" is a leaderboard_periods row with period_type='season'.
 * Its starts_at defines the cutoff — only single_night periods on or after
 * that date are included in the running standings. Starting a new season
 * effectively resets the leaderboard.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/staff-auth'
import { revalidateTag } from 'next/cache'

export async function GET(req: NextRequest) {
  const auth = await requireStaff()
  if (auth instanceof Response) return auth

  const eventTypeId = req.nextUrl.searchParams.get('eventTypeId')
  if (!eventTypeId) return NextResponse.json({ error: 'eventTypeId required' }, { status: 400 })

  const service = createServiceClient()

  const { data: season } = await service
    .from('leaderboard_periods')
    .select('id, label, starts_at, created_at')
    .eq('event_type_id', eventTypeId)
    .eq('period_type', 'season')
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ season: season ?? null })
}

export async function POST(req: NextRequest) {
  const auth = await requireStaff()
  if (auth instanceof Response) return auth

  const { eventTypeId, label } = await req.json()
  if (!eventTypeId) return NextResponse.json({ error: 'eventTypeId required' }, { status: 400 })

  const service = createServiceClient()

  // Verify event type exists
  const { data: et } = await service
    .from('event_types')
    .select('id, name')
    .eq('id', eventTypeId)
    .maybeSingle()

  if (!et) return NextResponse.json({ error: 'Event type not found' }, { status: 404 })

  // Default label: "Season 2026" or whatever the user provides
  const seasonLabel = label?.trim() || `Season ${new Date().getFullYear()}`

  const { data: season, error } = await service
    .from('leaderboard_periods')
    .insert({
      event_type_id: eventTypeId,
      label:         seasonLabel,
      period_type:   'season',
      starts_at:     new Date().toISOString(),
      is_finalized:  false,
    })
    .select('id, label, starts_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Bust the standings cache so the new season takes effect immediately
  try {
    revalidateTag(`leaderboard-${eventTypeId}`)
  } catch (e) {
    console.warn('revalidateTag failed:', (e as Error).message)
  }

  return NextResponse.json({ ok: true, season })
}
