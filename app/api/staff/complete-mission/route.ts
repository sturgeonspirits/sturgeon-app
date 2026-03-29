/**
 * POST /api/staff/complete-mission
 * Staff manually marks a mission complete for a member.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { completeMission } from '@/lib/earn-events'
import { requireStaff } from '@/lib/staff-auth'

export async function POST(req: NextRequest) {
  const auth = await requireStaff()
  if (auth instanceof Response) return auth

  try {
    const { missionSlug, userId, staffId, notes } = await req.json()
    if (!missionSlug || !userId) {
      return NextResponse.json({ error: 'missionSlug and userId required' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const earnEvent = await completeMission({
      userId,
      missionSlug,
      completedBy: staffId,
      notes: notes ?? 'Staff completion',
      supabase,
    })

    if (!earnEvent) {
      return NextResponse.json({ error: 'Mission already completed or not found' }, { status: 409 })
    }

    return NextResponse.json({ success: true, pointsEarned: earnEvent.points_delta })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 })
  }
}
