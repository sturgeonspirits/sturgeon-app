import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/staff-auth'

// GET  /api/staff/trivia-teams?eventTypeId=xxx  — list saved teams with members
// POST                                          — create or update a saved team
// DELETE                                        — delete a saved team

export async function GET(req: NextRequest) {
  const auth = await requireStaff()
  if (auth instanceof Response) return auth

  const eventTypeId = req.nextUrl.searchParams.get('eventTypeId')
  if (!eventTypeId) return NextResponse.json({ teams: [] })

  const supabase = createServiceClient()

  const { data: teams, error } = await supabase
    .from('trivia_teams')
    .select('id, name, trivia_team_members(user_id, profiles(id, display_name, full_name))')
    .eq('event_type_id', eventTypeId)
    .eq('is_active', true)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ teams: teams ?? [] })
}

export async function POST(req: NextRequest) {
  const auth = await requireStaff()
  if (auth instanceof Response) return auth

  const supabase = createServiceClient()
  const { id, name, eventTypeId, memberIds } = await req.json()

  if (!name || !eventTypeId) {
    return NextResponse.json({ error: 'name and eventTypeId required' }, { status: 400 })
  }

  let teamId = id

  if (id) {
    // Update existing saved team name
    const { error } = await supabase
      .from('trivia_teams')
      .update({ name })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    // Create new saved team
    const { data, error } = await supabase
      .from('trivia_teams')
      .insert({ name, event_type_id: eventTypeId })
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    teamId = data.id
  }

  // Replace members
  await supabase.from('trivia_team_members').delete().eq('team_id', teamId)
  if (memberIds?.length) {
    await supabase.from('trivia_team_members').insert(
      memberIds.map((uid: string) => ({ team_id: teamId, user_id: uid }))
    )
  }

  return NextResponse.json({ ok: true, id: teamId })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireStaff()
  if (auth instanceof Response) return auth

  const supabase = createServiceClient()
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await supabase.from('trivia_teams').update({ is_active: false }).eq('id', id)
  return NextResponse.json({ ok: true })
}
