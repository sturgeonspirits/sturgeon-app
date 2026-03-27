import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/join/team
// Adds the authenticated user to a team for the given period.
// teamId is the permanent_team_id — the period-specific row is found or created.
// Body: { token: string, teamId: string }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to join a team' }, { status: 401 })

  const { token, teamId } = await req.json()
  if (!token || !teamId) return NextResponse.json({ error: 'Missing token or teamId' }, { status: 400 })

  const service = createServiceClient()

  // Validate period
  const { data: period } = await service
    .from('leaderboard_periods')
    .select('id, is_finalized, event_type_id')
    .eq('join_token', token)
    .maybeSingle()

  if (!period) return NextResponse.json({ error: 'Invalid QR code' }, { status: 404 })
  if (period.is_finalized) return NextResponse.json({ error: 'This event has ended' }, { status: 410 })

  // Validate the permanent team belongs to this event type
  const { data: permTeam } = await service
    .from('permanent_teams')
    .select('id, name')
    .eq('id', teamId)
    .eq('event_type_id', period.event_type_id)
    .maybeSingle()

  if (!permTeam) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

  // Check if user is already on ANY team for this period
  const { data: allPeriodTeams } = await service
    .from('leaderboard_teams')
    .select('id, permanent_team_id, name')
    .eq('period_id', period.id)

  const teamIds = (allPeriodTeams ?? []).map((t: any) => t.id)

  if (teamIds.length > 0) {
    const { data: existing } = await service
      .from('leaderboard_team_members')
      .select('team_id')
      .eq('user_id', user.id)
      .in('team_id', teamIds)
      .maybeSingle()

    if (existing) {
      const existingTeam = (allPeriodTeams ?? []).find((t: any) => t.id === existing.team_id)
      if (existingTeam?.permanent_team_id === teamId) {
        // Already on this exact team — silently succeed
        return NextResponse.json({ ok: true, teamName: permTeam.name, alreadyMember: true })
      }
      return NextResponse.json({ error: `You're already on ${existingTeam?.name ?? 'another team'} for this event` }, { status: 409 })
    }
  }

  // ── Find or create the period-specific leaderboard_teams row ─────────────
  const { data: periodTeam, error: ptErr } = await service
    .from('leaderboard_teams')
    .upsert(
      { period_id: period.id, permanent_team_id: permTeam.id, name: permTeam.name, score: 0, placement: 0 },
      { onConflict: 'period_id,permanent_team_id', ignoreDuplicates: false }
    )
    .select('id')
    .single()

  if (ptErr || !periodTeam) {
    return NextResponse.json({ error: ptErr?.message ?? 'Could not set up team for this period' }, { status: 500 })
  }

  // Add user to team
  const { error: insertErr } = await service
    .from('leaderboard_team_members')
    .upsert({ team_id: periodTeam.id, user_id: user.id }, { onConflict: 'team_id,user_id', ignoreDuplicates: true })

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  // Also upsert a leaderboard_events row so they appear in standings
  await service.from('leaderboard_events').upsert({
    period_id: period.id,
    user_id:   user.id,
    score:     0,
  }, { onConflict: 'period_id,user_id' })

  return NextResponse.json({ ok: true, teamName: permTeam.name })
}
