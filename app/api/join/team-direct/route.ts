/**
 * POST /api/join/team-direct
 *
 * In-app team join — no QR token required, just a valid session.
 * Used when customers self-join from the leaderboard/standings page.
 *
 * Body: { periodId: string, teamId: string }
 * teamId is the permanent_team_id (same convention as /api/join/team)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to join a team' }, { status: 401 })

  const { periodId, teamId } = await req.json()
  if (!periodId || !teamId) return NextResponse.json({ error: 'Missing periodId or teamId' }, { status: 400 })

  const service = createServiceClient()

  // Validate the period exists and is still open
  const { data: period } = await service
    .from('leaderboard_periods')
    .select('id, is_finalized, event_type_id')
    .eq('id', periodId)
    .maybeSingle()

  if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 404 })
  if (period.is_finalized) return NextResponse.json({ error: 'This event has already ended' }, { status: 410 })

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
      return NextResponse.json(
        { error: `You're already on ${existingTeam?.name ?? 'another team'} tonight` },
        { status: 409 }
      )
    }
  }

  // Find or create the period-specific leaderboard_teams row
  const { data: periodTeam, error: ptErr } = await service
    .from('leaderboard_teams')
    .upsert(
      { period_id: period.id, permanent_team_id: permTeam.id, name: permTeam.name, score: 0, placement: 0 },
      { onConflict: 'period_id,permanent_team_id', ignoreDuplicates: false }
    )
    .select('id')
    .single()

  if (ptErr || !periodTeam) {
    return NextResponse.json({ error: ptErr?.message ?? 'Could not set up team' }, { status: 500 })
  }

  // Add user to team
  const { error: insertErr } = await service
    .from('leaderboard_team_members')
    .upsert({ team_id: periodTeam.id, user_id: user.id }, { onConflict: 'team_id,user_id', ignoreDuplicates: true })

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  // Upsert a leaderboard_events row so they appear in standings
  const { error: evErr } = await service
    .from('leaderboard_events')
    .upsert({ period_id: period.id, user_id: user.id, score: 0 }, { onConflict: 'period_id,user_id' })

  if (evErr) {
    console.error('leaderboard_events upsert failed:', evErr)
    return NextResponse.json({ error: 'Joined team but could not register for standings' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, teamName: permTeam.name })
}
