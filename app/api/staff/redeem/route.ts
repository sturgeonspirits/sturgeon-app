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
// ─────────────────────────────────────────────
// Changelog
//   v2026-08-10.1 — Mode 1 now calls the fulfill_redemption() SQL function so
//                   the status flip and the points deduction share one
//                   transaction. Was: flip status, then deduct — an overdraft
//                   raise left the reward redeemed and unpaid (free reward),
//                   and the UPDATE lacked a status guard so two concurrent
//                   approvals both went through.
//                   Mode 2 reordered to deduct BEFORE inserting the redemption
//                   row, with a compensating refund if the insert fails.
//                   Overdrafts now surface as 409, not 500.
// ─────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { emitEarnEvent } from '@/lib/earn-events'
import { requireStaff } from '@/lib/staff-auth'

/** sync_points_ledger raises with SQLSTATE 23514 when a spend would overdraft. */
const OVERDRAFT = '23514'

function isOverdraft(err: any): boolean {
  return err?.code === OVERDRAFT || /insufficient points/i.test(err?.message ?? '')
}

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
    //
    // Everything happens inside fulfill_redemption() (migration
    // 20260810000001): row lock → deduct → flip status, one transaction.
    // Do NOT reintroduce a read-then-write here; the deduction has to be able
    // to roll the status back with it.
    if (redemptionId) {
      const action = body.status === 'rejected' ? 'rejected' : 'redeemed'

      const { data, error } = await supabase.rpc('fulfill_redemption', {
        p_redemption_id: redemptionId,
        p_staff_id:      staffId,
        p_action:        action,
      })

      if (error) {
        if (isOverdraft(error)) {
          return NextResponse.json(
            { error: 'Customer does not have enough points for this reward. Nothing was redeemed.' },
            { status: 409 },
          )
        }
        throw error
      }

      const result = (data ?? {}) as { ok?: boolean; reason?: string; points_spent?: number }

      if (!result.ok) {
        return NextResponse.json(
          { error: 'Redemption not found or already fulfilled' },
          { status: 404 },
        )
      }

      return NextResponse.json({ success: true, pointsSpent: result.points_spent ?? 0 })
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

    // Deduct FIRST, then record the redemption.
    //
    // The balance check above is advisory only — it is a read-then-write and
    // two staff tablets can both pass it. The authority is the
    // sync_points_ledger trigger, which locks the ledger row and raises on
    // overdraft. Doing the deduction first means a failed deduction leaves no
    // redemption row behind, so the customer can never end up holding a
    // redeemed reward they did not pay for.
    let earnEventId: string | null = null

    if (pointsCost > 0) {
      try {
        const earnEvent = await emitEarnEvent({
          userId,
          eventType:   'reward_redeemed',
          pointsDelta: -pointsCost,
          contextType: 'reward',
          contextId:   reward.id,
          notes:       `Redeemed: ${reward.name}${notes ? ` — ${notes}` : ''}`,
          supabase,
        })
        earnEventId = earnEvent.id
      } catch (err: any) {
        if (isOverdraft(err)) {
          return NextResponse.json(
            { error: `Not enough points for ${reward.name}. Nothing was redeemed.` },
            { status: 409 },
          )
        }
        throw err
      }
    }

    // Create redemption record (already redeemed — no pending step)
    const { data: rr, error: rrErr } = await supabase
      .from('reward_redemptions')
      .insert({
        user_id:       userId,
        reward_id:     rewardId,
        status:        'redeemed',
        redeemed_at:   new Date().toISOString(),
        redeemed_by:   staffId ?? null,
        notes:         notes ?? null,
        earn_event_id: earnEventId,
      })
      .select('id')
      .single()

    if (rrErr || !rr) {
      // Points are already gone and there is no redemption to show for them.
      // Put them back rather than leaving the customer short.
      if (earnEventId) {
        try {
          await emitEarnEvent({
            userId,
            eventType:   'reward_redeemed',
            pointsDelta: pointsCost,
            contextType: 'reward',
            contextId:   reward.id,
            notes:       `Refund — redemption record failed for ${reward.name}`,
            supabase,
          })
        } catch (refundErr) {
          console.error('Redeem refund failed — manual correction needed:', {
            userId, rewardId, pointsCost, earnEventId, refundErr,
          })
        }
      }
      throw rrErr ?? new Error('Could not create redemption')
    }

    return NextResponse.json({ success: true, redemptionId: rr.id })
  } catch (err: any) {
    console.error('Redeem error:', err)
    if (isOverdraft(err)) {
      return NextResponse.json(
        { error: 'Customer does not have enough points. Nothing was redeemed.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 })
  }
}
