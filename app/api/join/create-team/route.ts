import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/join/create-team
// Creates a permanent team (if it doesn't exist), then creates/finds the
// per-period leaderboard_teams row and adds the creator as the first member.
// Body: { token: string, teamName: string }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to create a team' }, { status: 401 })

  const { token, teamName } = await req.json()
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  if (!teamName?.trim()) return NextResponse.json({ error: 'Team name is required' }, { status: 400 })

  const service = createServiceClient()

  // Validate period
  const { data: period } = await service
    .from('leaderboard_periods')
    .select('id, is_finalized, event_type_id')
    .eq('join_token', token)
    .maybeSingle()

  if (!period) return NextResponse.json({ error: 'Invalid QR code' }, { status: 404 })
  if (period.is_finalized) return NextResponse.json({ error: 'This event has ended' }, { status: 410 })

  // Separate query for event type — avoids reliance on PostgREST FK cache
  const { data: et } = await service
    .from('event_types')
    .select('participant_type')
    .eq('id', period.event_type_id)
    .maybeSingle()
  if (et?.participant_type !== 'team') {
    return NextResponse.json({ error: 'This event does not use teams' }, { status: 400 })
  }

  // ── 1. Upsert the permanent team (creates if new, returns if existing) ────
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

  // ── 2. Check if user is already on any team for this period ───────────────
  const { data: allPeriodTeams } = await service
    .from('leaderboard_teams')
    .select('id')
    .eq('period_id', period.id)

  const teamIds = (allPeriodTeams ?? []).map((t: any) => t.id)

  if (teamIds.length > 0) {
    const { data: existingMembership } = await service
      .from('leaderboard_team_members')
      .select('team_id, leaderboard_teams(name)')
      .eq('user_id', user.id)
      .in('team_id', teamIds)
      .maybeSingle()

    if (existingMembership) {
      const name = (existingMembership as any).leaderboard_teams?.name ?? 'another team'
      return NextResponse.json({ error: `You're already on ${name}` }, { status: 409 })
    }
  }

  // ── 3. Find or create this period's leaderboard_teams row ─────────────────
  const { data: periodTeam, error: ptErr } = await service
    .from('leaderboard_teams')
    .upsert(
      { period_id: period.id, permanent_team_id: permTeam.id, name: permTeam.name, score: 0, placement: 0 },
      { onConflict: 'period_id,permanent_team_id', ignoreDuplicates: false }
    )
    .select('id, name')
    .single()

  if (ptErr || !periodTeam) {
    return NextResponse.json({ error: ptErr?.message ?? 'Could not set up team for this period' }, { status: 500 })
  }

  // ── 4. Add creator as first member ────────────────────────────────────────
  const { error: memberErr } = await service
    .from('leaderboard_team_members')
    .upsert({ team_id: periodTeam.id, user_id: user.id }, { onConflict: 'team_id,user_id', ignoreDuplicates: true })

  if (memberErr) {
    console.error('leaderboard_team_members upsert failed:', memberErr)
    return NextResponse.json({ error: 'Team created but could not add you as member. Please try joining again.' }, { status: 500 })
  }

  // ── 5. Add leaderboard_events row so creator appears in standings ──────────
  const { error: evErr } = await service.from('leaderboard_events').upsert({
    period_id: period.id,
    user_id:   user.id,
    score:     0,
  }, { onConflict: 'period_id,user_id' })

  if (evErr) {
    console.error('leaderboard_events upsert failed:', evErr)
    return NextResponse.json({ error: 'Team created but could not register for standings. Please try again.' }, { status: 500 })
  }

  // Return the permanent_team_id so the team QR link uses it
  return NextResponse.json({ ok: true, teamId: permTeam.id, teamName: permTeam.name })
}
