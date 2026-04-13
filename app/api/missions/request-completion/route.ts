/**
 * POST /api/missions/request-completion
 *
 * Customer taps "I did this!" on a manual_staff mission.
 * Creates a pending request — staff approves from the missions queue.
 *
 * Body: { missionId: string }
 * Returns: { requestId: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  // Rate limit: 10 mission requests per IP per 60 seconds
  const { ok, retryAfter } = rateLimit(getClientIp(req), 'mission-request', 10, 60)
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

  const { missionId } = await req.json()
  if (!missionId) return NextResponse.json({ error: 'missionId required' }, { status: 400 })

  // Validate mission exists, is active, and is manually completed
  const { data: mission } = await service
    .from('missions')
    .select('id, title, slug, completion_trigger, is_active')
    .eq('id', missionId)
    .maybeSingle()

  if (!mission || !mission.is_active) {
    return NextResponse.json({ error: 'Mission not found or inactive' }, { status: 404 })
  }

  if (mission.completion_trigger !== 'manual_staff') {
    return NextResponse.json({ error: 'This mission does not support customer requests' }, { status: 400 })
  }

  // Check if already completed
  const { data: alreadyDone } = await service
    .from('earn_events')
    .select('id')
    .eq('user_id', user.id)
    .eq('context_type', 'mission')
    .eq('context_id', missionId)
    .maybeSingle()

  if (alreadyDone) {
    return NextResponse.json({ error: 'Mission already completed' }, { status: 409 })
  }

  // Check for existing pending request (unique index handles this, but give a clean error)
  const { data: existing } = await service
    .from('mission_completion_requests')
    .select('id')
    .eq('user_id', user.id)
    .eq('mission_id', missionId)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ requestId: existing.id, alreadyRequested: true })
  }

  // Create pending request
  const { data: request, error: reqErr } = await service
    .from('mission_completion_requests')
    .insert({
      user_id:    user.id,
      mission_id: missionId,
      status:     'pending',
    })
    .select('id')
    .single()

  if (reqErr || !request) {
    console.error('[missions/request-completion] Insert error:', reqErr?.message)
    return NextResponse.json({ error: 'Could not create request' }, { status: 500 })
  }

  return NextResponse.json({ requestId: request.id })
}
