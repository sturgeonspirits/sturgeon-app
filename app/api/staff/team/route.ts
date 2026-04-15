/**
 * Staff team management API
 *
 * PATCH /api/staff/team  { teamId, name }  → rename
 * DELETE /api/staff/team { teamId }        → delete (cascades to leaderboard rows)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/staff-auth'

export async function PATCH(req: NextRequest) {
  const auth = await requireStaff()
  if (auth instanceof NextResponse) return auth

  const { teamId, name } = await req.json()
  if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 })
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const service = createServiceClient()

  // Check for name conflict within the same event type
  const { data: existing } = await service
    .from('permanent_teams')
    .select('id, event_type_id')
    .eq('id', teamId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

  const { data: conflict } = await service
    .from('permanent_teams')
    .select('id')
    .eq('event_type_id', existing.event_type_id)
    .ilike('name', name.trim())
    .neq('id', teamId)
    .maybeSingle()

  if (conflict) return NextResponse.json({ error: 'A team with that name already exists' }, { status: 409 })

  // Rename permanent_teams row and sync name on all leaderboard_teams rows
  const { error: ptErr } = await service
    .from('permanent_teams')
    .update({ name: name.trim() })
    .eq('id', teamId)

  if (ptErr) return NextResponse.json({ error: ptErr.message }, { status: 500 })

  // Keep leaderboard_teams.name in sync so historical periods show the new name
  await service
    .from('leaderboard_teams')
    .update({ name: name.trim() })
    .eq('permanent_team_id', teamId)

  return NextResponse.json({ ok: true, name: name.trim() })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireStaff()
  if (auth instanceof NextResponse) return auth

  const { teamId } = await req.json()
  if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 })

  const service = createServiceClient()

  // Delete members first (in case CASCADE isn't wired on the DB yet)
  await service
    .from('leaderboard_team_members')
    .delete()
    .in('team_id',
      service
        .from('leaderboard_teams')
        .select('id')
        .eq('permanent_team_id', teamId) as any
    )

  await service
    .from('leaderboard_teams')
    .delete()
    .eq('permanent_team_id', teamId)

  const { error } = await service
    .from('permanent_teams')
    .delete()
    .eq('id', teamId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
