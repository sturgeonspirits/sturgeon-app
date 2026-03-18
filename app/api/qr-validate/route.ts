/**
 * POST /api/qr-validate
 * Customer scans a QR code → validate the HMAC token → emit earn event.
 */
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { createServiceClient } from '@/lib/supabase/server'
import { completeMission } from '@/lib/earn-events'

const SECRET = new TextEncoder().encode(process.env.QR_HMAC_SECRET!)

export async function POST(req: NextRequest) {
  try {
    const { token, missionId, userId } = await req.json()

    if (!token || !userId) {
      return NextResponse.json({ error: 'Missing token or userId' }, { status: 400 })
    }

    // 1. Verify HMAC-signed JWT (15-min TTL enforced by jose)
    let payload: any
    try {
      const { payload: p } = await jwtVerify(token, SECRET)
      payload = p
    } catch {
      return NextResponse.json({ error: 'Invalid or expired QR code' }, { status: 401 })
    }

    // 2. Token must match the claimed mission
    if (payload.missionId !== missionId) {
      return NextResponse.json({ error: 'QR code is for a different mission' }, { status: 400 })
    }

    // 3. Complete the mission (handles duplication check internally)
    const supabase = createServiceClient()
    const earnEvent = await completeMission({
      userId,
      missionSlug: payload.missionSlug,
      locationId:  payload.locationId,
      notes:       'QR scan',
      supabase,
    })

    if (!earnEvent) {
      return NextResponse.json({ error: 'Mission already completed' }, { status: 409 })
    }

    // 4. Fetch mission title for confirmation message
    const { data: mission } = await supabase
      .from('missions')
      .select('title, points')
      .eq('slug', payload.missionSlug)
      .single()

    return NextResponse.json({
      success: true,
      pointsEarned: earnEvent.points_delta,
      missionTitle: mission?.title ?? payload.missionSlug,
    })
  } catch (err: any) {
    console.error('QR validate error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
