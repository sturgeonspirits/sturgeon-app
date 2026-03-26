import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/join/team
// Adds the authenticated user to a trivia team for the given period.
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
    .select('id, is_open')
    .eq('join_token', token)
    .maybeSingle()

  if (!period) return NextResponse.json({ error: 'Invalid QR code' }, { status: 404 })
  if (!period.is_open) return NextResponse.json({ error: 'This event has ended' }, { status: 410 })

  // Validate team belongs to this period
  const { data: team } = await service
    .from('leaderboard_teams')
    .select('id, name')
    .eq('id', teamId)
    .eq('period_id', period.id)
    .maybeSingle()

  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

  // Check if user is already on ANY team for this period
  const { data: existing } = await service
    .from('leaderboard_team_members')
    .select('team_id, leaderboard_teams(name)')
    .eq('user_id', user.id)
    .in('team_id',
      (await service.from('leaderboard_teams').select('id').eq('period_id', period.id))
        .data?.map(t => t.id) ?? []
    )
    .maybeSingle()

  if (existing) {
    const existingName = (existing as any).leaderboard_teams?.name ?? 'another team'
    if (existing.team_id === teamId) {
      return NextResponse.json({ ok: true, teamName: team.name, alreadyMember: true })
    }
    return NextResponse.json({ error: `You're already on ${existingName} for this event` }, { status: 409 })
  }

  // Add to team
  const { error: insertErr } = await service
    .from('leaderboard_team_members')
    .insert({ team_id: teamId, user_id: user.id })

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  // Also upsert a leaderboard_events row so they appear in standings
  await service.from('leaderboard_events').upsert({
    period_id: period.id,
    user_id:   user.id,
    score:     0,
  }, { onConflict: 'period_id,user_id' })

  return NextResponse.json({ ok: true, teamName: team.name })
}
