import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

async function assertStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['staff', 'admin'].includes(profile.role)) throw new Error('Not authorised')
}

// POST — create
export async function POST(req: NextRequest) {
  try {
    await assertStaff()
    const body = await req.json()
    const service = createServiceClient()

    const { data, error } = await service
      .from('rewards')
      .insert({
        name:               body.name,
        description:        body.description ?? null,
        icon:               body.icon ?? '🎁',
        redemption_method:  body.redemption_method,
        points_cost:        body.points_cost ?? 0,
        reward_type:        body.reward_type ?? 'custom',
        reward_value:       body.reward_value ?? null,
        is_active:          body.is_active ?? true,
        max_per_user:       body.max_per_user ?? null,
        total_supply:       body.total_supply ?? null,
        tier_required:      body.tier_required ?? 'newcomer',
        sort_order:         body.sort_order ?? 0,
        expires_at:         body.expires_at ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 })
  }
}

// PATCH — update
export async function PATCH(req: NextRequest) {
  try {
    await assertStaff()
    const body = await req.json()
    const { id, ...fields } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const service = createServiceClient()
    const { data, error } = await service
      .from('rewards')
      .update({
        name:               fields.name,
        description:        fields.description ?? null,
        icon:               fields.icon ?? '🎁',
        redemption_method:  fields.redemption_method,
        points_cost:        fields.points_cost ?? 0,
        reward_type:        fields.reward_type ?? 'custom',
        reward_value:       fields.reward_value ?? null,
        is_active:          fields.is_active ?? true,
        max_per_user:       fields.max_per_user ?? null,
        total_supply:       fields.total_supply ?? null,
        tier_required:      fields.tier_required ?? 'newcomer',
        sort_order:         fields.sort_order ?? 0,
        expires_at:         fields.expires_at ?? null,
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

// DELETE
export async function DELETE(req: NextRequest) {
  try {
    await assertStaff()
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const service = createServiceClient()

    // Check if any redemptions reference this reward — soft delete instead if so
    const { count } = await service
      .from('reward_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('reward_id', id)

    if (count && count > 0) {
      // Deactivate instead of hard delete to preserve redemption history
      await service.from('rewards').update({ is_active: false }).eq('id', id)
      return NextResponse.json({ ok: true, note: 'Deactivated (has redemption history)' })
    }

    const { error } = await service.from('rewards').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 })
  }
}
