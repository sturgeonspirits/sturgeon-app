/**
 * POST /api/staff/manual-checkin
 * Staff-only: retroactively grant a bar check-in to any customer.
 * No duplicate guard — staff override is intentional.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { emitEarnEvent } from '@/lib/earn-events'
import { localDate } from '@/lib/checkin-token'

const CHECKIN_POINTS = 15

export async function POST(req: NextRequest) {
  try {
    // Auth + role check
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const appRole: string = (user as any).app_metadata?.role ?? ''
    if (!['staff', 'admin'].includes(appRole)) {
      const service = createServiceClient()
      const { data: p } = await service.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (!['staff', 'admin'].includes(p?.role ?? '')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const service = createServiceClient()

    const earnEvent = await emitEarnEvent({
      userId,
      eventType:   'bar_checkin',
      pointsDelta: CHECKIN_POINTS,
      contextType: 'checkin',
      notes:       `Manual check-in ${localDate(0)} by staff`,
      supabase:    service,
    })

    return NextResponse.json({ success: true, pointsEarned: earnEvent.points_delta })
  } catch (err: any) {
    console.error('manual-checkin error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
