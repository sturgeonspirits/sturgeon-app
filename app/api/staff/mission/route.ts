import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/staff-auth'

export async function POST(req: NextRequest) {
  const auth = await requireStaff()
  if (auth instanceof Response) return auth

  try {
    const supabase = createServiceClient()
    const body = await req.json()

    const { data, error } = await supabase
      .from('missions')
      .insert({
        slug:               body.slug,
        title:              body.title,
        description:        body.description ?? null,
        icon:               body.icon ?? '🎯',
        points:             body.points ?? 50,
        completion_trigger: body.completion_trigger,
        is_repeatable:      body.is_repeatable ?? false,
        repeat_limit:       body.repeat_limit ?? null,
        repeat_cooldown_days: body.repeat_cooldown_days ?? null,
        min_tier:           body.min_tier ?? 'newcomer',
        is_active:          body.is_active ?? true,
        sort_order:         body.sort_order ?? 0,
      })
      .select('id')
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, id: data.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireStaff()
  if (auth instanceof Response) return auth

  try {
    const supabase = createServiceClient()
    const body = await req.json()
    const { id, ...fields } = body

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { error } = await supabase.from('missions').update(fields).eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireStaff()
  if (auth instanceof Response) return auth

  try {
    const supabase = createServiceClient()
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { count } = await supabase
      .from('mission_completions')
      .select('id', { count: 'exact', head: true })
      .eq('mission_id', id)

    if ((count ?? 0) > 0) {
      await supabase.from('missions').update({ is_active: false }).eq('id', id)
      return NextResponse.json({ success: true, softDeleted: true })
    }

    const { error } = await supabase.from('missions').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
