import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/join/create-team
// Customer creates a new team for a trivia period and is auto-added as first member.
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
    .select('id, is_finalized, event_type_id, event_types(participant_type)')
    .eq('join_token', token)
    .maybeSingle()

  if (!period) return NextResponse.json({ error: 'Invalid QR code' }, { status: 404 })
  if (period.is_finalized) return NextResponse.json({ error: 'This event has ended' }, { status: 410 })

  const et = (period as any).event_types
  if (et?.participant_type !== 'team') {
    return NextResponse.json({ error: 'This event does not use teams' }, { status: 400 })
  }

  // Check if user is already on a team for this period
  const { data: allTeams } = await service
    .from('leaderboard_teams')
    .select('id')
    .eq('period_id', period.id)

  const teamIds = (allTeams ?? []).map(t => t.id)

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

  // Check for duplicate team name in this period
  const { data: duplicate } = await service
    .from('leaderboard_teams')
    .select('id')
    .eq('period_id', period.id)
    .ilike('name', teamName.trim())
    .maybeSingle()

  if (duplicate) {
    return NextResponse.json({ error: 'A team with that name already exists — try joining it instead' }, { status: 409 })
  }

  // Create the team
  const { data: team, error: teamErr } = await service
    .from('leaderboard_teams')
    .insert({ period_id: period.id, name: teamName.trim(), score: 0, placement: 0 })
    .select('id, name')
    .single()

  if (teamErr || !team) {
    return NextResponse.json({ error: teamErr?.message ?? 'Could not create team' }, { status: 500 })
  }

  // Add creator as first member
  await service.from('leaderboard_team_members').insert({ team_id: team.id, user_id: user.id })

  // Add leaderboard_events row so creator appears in standings
  await service.from('leaderboard_events').upsert({
    period_id: period.id,
    user_id:   user.id,
    score:     0,
  }, { onConflict: 'period_id,user_id' })

  // Return a team-specific join token (reuse the period token + teamId)
  return NextResponse.json({ ok: true, teamId: team.id, teamName: team.name })
}
