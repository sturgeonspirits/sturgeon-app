/**
 * POST /api/staff/generate-qr
 * Generate an HMAC-signed JWT token for a mission QR code.
 * 15-minute TTL. Token is returned as a data URL for display.
 */
import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { createServiceClient } from '@/lib/supabase/server'

const SECRET = new TextEncoder().encode(process.env.QR_HMAC_SECRET!)

export async function POST(req: NextRequest) {
  try {
    const { missionId, staffId, locationId } = await req.json()
    if (!missionId) return NextResponse.json({ error: 'missionId required' }, { status: 400 })

    const supabase = createServiceClient()

    // Fetch mission slug
    const { data: mission } = await supabase
      .from('missions')
      .select('id, slug, title')
      .eq('id', missionId)
      .single()

    if (!mission) return NextResponse.json({ error: 'Mission not found' }, { status: 404 })

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

    // Sign the token
    const token = await new SignJWT({
      missionId:   mission.id,
      missionSlug: mission.slug,
      locationId:  locationId ?? null,
      staffId,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(SECRET)

    // Record in DB for audit trail
    await supabase.from('qr_tokens').insert({
      token,
      mission_id:  mission.id,
      location_id: locationId ?? null,
      created_by:  staffId,
      expires_at:  expiresAt.toISOString(),
    })

    // Generate QR code as data URL using the qrcode library
    // (install: npm install qrcode @types/qrcode)
    // For Phase 1 we return the raw token; frontend renders via a QR library
    // or this endpoint can use the `qrcode` package:
    //
    //   const QRCode = require('qrcode')
    //   const qrDataUrl = await QRCode.toDataURL(token)
    //   return NextResponse.json({ qrDataUrl, token, expiresAt })
    //
    // Returning token for now; add qrcode package when ready.
    return NextResponse.json({ token, expiresAt: expiresAt.toISOString(), missionTitle: mission.title })
  } catch (err: any) {
    console.error('Generate QR error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
