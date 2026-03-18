/**
 * POST /api/staff/redeem
 * Mark a reward redemption as fulfilled by staff.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    // Support both JSON and form data
    const redemptionId = body?.redemptionId ?? (await req.formData().then(f => f.get('redemptionId')))
    const staffId      = body?.staffId      ?? (await req.formData().then(f => f.get('staffId')))

    if (!redemptionId) return NextResponse.json({ error: 'redemptionId required' }, { status: 400 })

    const supabase = createServiceClient()

    const { error } = await supabase
      .from('reward_redemptions')
      .update({
        status:      'redeemed',
        redeemed_at: new Date().toISOString(),
        redeemed_by: staffId ?? null,
      })
      .eq('id', redemptionId)
      .eq('status', 'pending')  // Only redeem pending ones

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 })
  }
}
