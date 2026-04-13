/**
 * POST /api/rewards/redeem
 *
 * Customer-facing: creates a PENDING redemption request.
 * Points are NOT deducted here — that happens only when staff approves
 * via POST /api/staff/redeem with { redemptionId }.
 *
 * Body: { rewardId: string }
 * Returns: { redemptionId: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  // Rate limit: 5 redemption attempts per IP per 60 seconds
  const { ok, retryAfter } = rateLimit(getClientIp(req), 'redeem', 5, 60)
  if (!ok) {
    return NextResponse.json(
      { error: 'Too many requests — please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const service = createServiceClient()

  const { rewardId } = await req.json()
  if (!rewardId) return NextResponse.json({ error: 'rewardId required' }, { status: 400 })

  // Validate reward exists and is active
  const { data: reward } = await service
    .from('rewards')
    .select('id, name, points_cost, is_active, redemption_method')
    .eq('id', rewardId)
    .maybeSingle()

  if (!reward || !reward.is_active) {
    return NextResponse.json({ error: 'Reward not found or inactive' }, { status: 404 })
  }

  if (reward.redemption_method !== 'points') {
    return NextResponse.json({ error: 'This reward cannot be redeemed with points' }, { status: 400 })
  }

  // Check the customer has sufficient points
  if (reward.points_cost > 0) {
    const { data: ledger } = await service
      .from('points_ledger')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle()

    const balance = ledger?.balance ?? 0
    if (balance < reward.points_cost) {
      return NextResponse.json(
        { error: `Not enough points (have ${balance}, need ${reward.points_cost})` },
        { status: 400 }
      )
    }
  }

  // Create a PENDING redemption — staff must approve before points are deducted
  const { data: rr, error: rrErr } = await service
    .from('reward_redemptions')
    .insert({
      user_id:   user.id,
      reward_id: rewardId,
      status:    'pending',
    })
    .select('id')
    .single()

  if (rrErr || !rr) {
    console.error('[rewards/redeem] Insert error:', rrErr?.message)
    return NextResponse.json({ error: 'Could not create redemption request' }, { status: 500 })
  }

  return NextResponse.json({ redemptionId: rr.id })
}
