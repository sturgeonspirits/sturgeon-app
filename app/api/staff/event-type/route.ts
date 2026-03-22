import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function assertStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const role: string = (user as any).app_metadata?.role ?? ''
  if (['staff', 'admin'].includes(role)) return { supabase, user }

  // Fallback: check profiles table
  const service = createServiceClient()
  const { data } = await service.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!['staff', 'admin'].includes(data?.role ?? '')) throw new Error('Forbidden')

  return { supabase, user }
}

export async function POST(req: NextRequest) {
  try {
    await assertStaff()
    const service = createServiceClient()
    const body = await req.json()

    const { data, error } = await service
      .from('event_types')
      .insert({
        name:         body.name,
        slug:         body.slug,
        icon:         body.icon ?? null,
        day_of_week:  body.day_of_week ?? null,
        typical_time: body.typical_time ?? null,
        description:  body.description ?? null,
        is_active:    body.is_active ?? true,
        sort_order:   body.sort_order ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await assertStaff()
    const service = createServiceClient()
    const body = await req.json()
    const { id, ...fields } = body

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { data, error } = await service
      .from('event_types')
      .update({
        name:         fields.name,
        slug:         fields.slug,
        icon:         fields.icon ?? null,
        day_of_week:  fields.day_of_week ?? null,
        typical_time: fields.typical_time ?? null,
        description:  fields.description ?? null,
        is_active:    fields.is_active ?? true,
        sort_order:   fields.sort_order ?? null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await assertStaff()
    const service = createServiceClient()
    const { id } = await req.json()

    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { error } = await service.from('event_types').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 })
  }
}
