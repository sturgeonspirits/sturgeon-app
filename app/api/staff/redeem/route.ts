/**
 * POST /api/staff/redeem
 *
 * Two modes:
 *
 * 1. Fulfill a pending redemption (customer-initiated):
 *    { redemptionId, staffId }
 *    → marks it redeemed + deducts points
 *
 * 2. Direct staff redemption (staff-initiated at counter):
 *    { userId, rewardId, staffId, notes? }
 *    → creates redemption record + deducts points in one step
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { emitEarnEvent } from '@/lib/earn-events'
import { requireStaff } from '@/lib/staff-auth'

export async function POST(req: NextRequest) {
  const auth = await requireStaff()
  if (auth instanceof NextResponse) return auth

  try {
    const body = await req.json()
    const { redemptionId, userId, rewardId, notes } = body
    // Derive staffId from verified session — never trust the client body
    const staffId = auth.user.id

    const supabase = createServiceClient()

    // ── Mode 1: fulfill or reject an existing pending redemption ─────────
    if (redemptionId) {
      const action = body.status === 'rejected' ? 'rejected' : 'redeemed'

      // Fetch the redemption + its reward so we know the points cost
      const { data: rr } = await supabase
        .from('reward_redemptions')
        .select('id, user_id, status, rewards(id, name, points_cost)')
        .eq('id', redemptionId)
        .eq('status', 'pending')
        .maybeSingle()

      if (!rr) return NextResponse.json({ error: 'Redemption not found or already fulfilled' }, { status: 404 })

      const reward = (rr as any).rewards
      const cost   = reward?.points_cost ?? 0

      // Update status
      const { error: updateErr } = await supabase
        .from('reward_redemptions')
        .update({ status: action, redeemed_at: new Date().toISOString(), redeemed_by: staffId ?? null })
        .eq('id', redemptionId)

      if (updateErr) throw updateErr

      // Deduct points only on approval
      if (action === 'redeemed' && cost > 0) {
        await emitEarnEvent({
          userId:       rr.user_id,
          eventType:    'reward_redeemed',
          pointsDelta:  -cost,
          contextType:  'reward',
          contextId:    reward.id,
          notes:        `Redeemed: ${reward.name}`,
          supabase,
        })
      }

      return NextResponse.json({ success: true })
    }

    // ── Mode 2: staff-initiated direct redemption ─────────────────────────
    if (!userId || !rewardId) {
      return NextResponse.json({ error: 'Provide either redemptionId or userId + rewardId' }, { status: 400 })
    }

    // Fetch reward
    const { data: reward } = await supabase
      .from('rewards')
      .select('id, name, points_cost, is_active')
      .eq('id', rewardId)
      .maybeSingle()

    if (!reward || !reward.is_active) {
      return NextResponse.json({ error: 'Reward not found or inactive' }, { status: 404 })
    }

    // Check customer has enough points
    const { data: ledger } = await supabase
      .from('points_ledger')
      .select('balance')
      .eq('user_id', userId)
      .maybeSingle()

    const balance = ledger?.balance ?? 0
    const pointsCost = reward.points_cost ?? 0
    if (pointsCost > 0 && balance < pointsCost) {
      return NextResponse.json({ error: `Not enough points (have ${balance}, need ${pointsCost})` }, { status: 400 })
    }

    // Create redemption record (already redeemed — no pending step)
    const { data: rr, error: rrErr } = await supabase
      .from('reward_redemptions')
      .insert({
        user_id:     userId,
        reward_id:   rewardId,
        status:      'redeemed',
        redeemed_at: new Date().toISOString(),
        redeemed_by: staffId ?? null,
        notes:       notes ?? null,
      })
      .select('id')
      .single()

    if (rrErr || !rr) throw rrErr ?? new Error('Could not create redemption')

    // Deduct points
    if (pointsCost > 0) {
      const earnEvent = await emitEarnEvent({
        userId,
        eventType:   'reward_redeemed',
        pointsDelta: -pointsCost,
        contextType: 'reward',
        contextId:   reward.id,
        notes:       `Redeemed: ${reward.name}${notes ? ` — ${notes}` : ''}`,
        supabase,
      })

      // Link earn event to redemption
      await supabase
        .from('reward_redemptions')
        .update({ earn_event_id: earnEvent.id })
        .eq('id', rr.id)
    }

    return NextResponse.json({ success: true, redemptionId: rr.id })
  } catch (err: any) {
    console.error('Redeem error:', err)
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 })
  }
}
