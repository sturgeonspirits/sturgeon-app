import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/join/register-individual
// Registers a customer for an individual event (e.g. cribbage) without joining a team.
// Simply adds a leaderboard_events row so staff can see who's planning to attend.
// Body: { periodId: string }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to register' }, { status: 401 })

  const { periodId } = await req.json()
  if (!periodId) return NextResponse.json({ error: 'Missing periodId' }, { status: 400 })

  const service = createServiceClient()

  // Validate period is open and current/future
  const { data: period } = await service
    .from('leaderboard_periods')
    .select('id, is_finalized, starts_at')
    .eq('id', periodId)
    .maybeSingle()

  if (!period) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  if (period.is_finalized) return NextResponse.json({ error: 'This event has already ended' }, { status: 410 })

  const todayChicago = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  const periodDateChicago = new Date(period.starts_at).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  if (periodDateChicago < todayChicago) {
    return NextResponse.json({ error: 'Sign-up is only available for current or upcoming events' }, { status: 410 })
  }

  // Upsert leaderboard_events row (score 0 — staff will fill in actual scores later)
  const { error } = await service
    .from('leaderboard_events')
    .upsert(
      { period_id: periodId, user_id: user.id, score: 0 },
      { onConflict: 'period_id,user_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
