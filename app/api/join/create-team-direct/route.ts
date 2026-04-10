import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/join/create-team-direct
// Creates a new team for a period without requiring a QR token (customer self-serve).
// Body: { periodId: string, teamName: string }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to create a team' }, { status: 401 })

  const { periodId, teamName } = await req.json()
  if (!periodId) return NextResponse.json({ error: 'Missing periodId' }, { status: 400 })
  if (!teamName?.trim()) return NextResponse.json({ error: 'Team name is required' }, { status: 400 })

  const service = createServiceClient()

  // Validate period exists, is not finalized, and is current/future (America/Chicago)
  const { data: period } = await service
    .from('leaderboard_periods')
    .select('id, is_finalized, starts_at, event_type_id')
    .eq('id', periodId)
    .maybeSingle()

  if (!period) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  if (period.is_finalized) return NextResponse.json({ error: 'This event has already ended' }, { status: 410 })

  const todayChicago = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  const periodDateChicago = new Date(period.starts_at).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
  if (periodDateChicago < todayChicago) {
    return NextResponse.json({ error: 'Sign-up is only available for current or upcoming events' }, { status: 410 })
  }

  // Separate query for event type — avoids reliance on PostgREST FK cache
  const { data: et } = await service
    .from('event_types')
    .select('participant_type')
    .eq('id', period.event_type_id)
    .maybeSingle()
  if (et?.participant_type !== 'team') {
    return NextResponse.json({ error: 'This event does not use teams' }, { status: 400 })
  }

  // ── 1. Upsert permanent team ──────────────────────────────────────────────
  const { data: permTeam, error: permErr } = await service
    .from('permanent_teams')
    .upsert(
      { event_type_id: period.event_type_id, name: teamName.trim() },
      { onConflict: 'event_type_id,name', ignoreDuplicates: false }
    )
    .select('id, name')
    .single()

  if (permErr || !permTeam) {
    return NextResponse.json({ error: permErr?.message ?? 'Could not create team' }, { status: 500 })
  }

  // ── 2. Check user not already on a team for this period ───────────────────
  const { data: allPeriodTeams } = await service
    .from('leaderboard_teams')
    .select('id')
    .eq('period_id', period.id)

  const teamIds = (allPeriodTeams ?? []).map((t: any) => t.id)

  if (teamIds.length > 0) {
    const { data: existing } = await service
      .from('leaderboard_team_members')
      .select('team_id, leaderboard_teams(name)')
      .eq('user_id', user.id)
      .in('team_id', teamIds)
      .maybeSingle()

    if (existing) {
      const name = (existing as any).leaderboard_teams?.name ?? 'another team'
      return NextResponse.json({ error: `You're already signed up on ${name}` }, { status: 409 })
    }
  }

  // ── 3. Find or create period leaderboard_teams row ────────────────────────
  const { data: periodTeam, error: ptErr } = await service
    .from('leaderboard_teams')
    .upsert(
      { period_id: period.id, permanent_team_id: permTeam.id, name: permTeam.name, score: 0, placement: 0 },
      { onConflict: 'period_id,permanent_team_id', ignoreDuplicates: false }
    )
    .select('id, name')
    .single()

  if (ptErr || !periodTeam) {
    return NextResponse.json({ error: ptErr?.message ?? 'Could not set up team' }, { status: 500 })
  }

  // ── 4. Add creator as member ───────────────────────────────────────────────
  const { error: memberErr } = await service
    .from('leaderboard_team_members')
    .upsert({ team_id: periodTeam.id, user_id: user.id }, { onConflict: 'team_id,user_id', ignoreDuplicates: true })

  if (memberErr) {
    return NextResponse.json({ error: 'Team created but could not add you as member' }, { status: 500 })
  }

  // ── 5. Register in leaderboard_events for standings ───────────────────────
  await service.from('leaderboard_events').upsert({
    period_id: period.id,
    user_id:   user.id,
    score:     0,
  }, { onConflict: 'period_id,user_id' })

  return NextResponse.json({ ok: true, teamId: permTeam.id, teamName: permTeam.name })
}
