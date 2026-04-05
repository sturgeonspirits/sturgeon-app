/**
 * POST /api/staff/approve-mission-request
 *
 * Staff approves or rejects a pending mission completion request.
 *
 * Body: { requestId: string, action: 'approve' | 'reject' }
 * Returns: { success: true, pointsEarned?: number }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { completeMission } from '@/lib/earn-events'
import { requireStaff } from '@/lib/staff-auth'

export async function POST(req: NextRequest) {
  const auth = await requireStaff()
  if (auth instanceof NextResponse) return auth

  const service = createServiceClient()
  const staffId = auth.user.id

  const { requestId, action } = await req.json()
  if (!requestId || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'requestId and action (approve|reject) required' }, { status: 400 })
  }

  // Fetch the request
  const { data: request } = await service
    .from('mission_completion_requests')
    .select('id, user_id, mission_id, status, missions(slug, title)')
    .eq('id', requestId)
    .eq('status', 'pending')
    .maybeSingle()

  if (!request) {
    return NextResponse.json({ error: 'Request not found or already resolved' }, { status: 404 })
  }

  const mission = (request as any).missions

  let pointsEarned = 0

  if (action === 'approve') {
    // Complete the mission — this emits the earn_event and deducts/credits points
    const earnEvent = await completeMission({
      userId:      request.user_id,
      missionSlug: mission.slug,
      completedBy: staffId,
      notes:       'Approved via customer request',
      supabase:    service,
    })

    if (!earnEvent) {
      // Already completed between request and approval
      await service
        .from('mission_completion_requests')
        .update({ status: 'approved', reviewed_by: staffId, reviewed_at: new Date().toISOString() })
        .eq('id', requestId)
      return NextResponse.json({ success: true, pointsEarned: 0, note: 'Already completed' })
    }

    pointsEarned = earnEvent.points_delta ?? 0
  }

  // Update request status
  await service
    .from('mission_completion_requests')
    .update({
      status:      action === 'approve' ? 'approved' : 'rejected',
      reviewed_by: staffId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  return NextResponse.json({ success: true, pointsEarned })
}
