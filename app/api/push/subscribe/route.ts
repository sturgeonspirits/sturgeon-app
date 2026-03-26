import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/push/subscribe
// Saves (or updates) a Web Push subscription for the authenticated user.
// Body: { subscription: PushSubscriptionJSON }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { subscription } = await req.json()
  if (!subscription?.endpoint) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service.from('push_subscriptions').upsert({
    user_id:      user.id,
    endpoint:     subscription.endpoint,
    p256dh:       subscription.keys?.p256dh   ?? '',
    auth:         subscription.keys?.auth      ?? '',
    user_agent:   req.headers.get('user-agent') ?? '',
    last_used_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/push/subscribe
// Removes a push subscription when user opts out.
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { endpoint } = await req.json()
  const service = createServiceClient()
  await service.from('push_subscriptions').delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)

  return NextResponse.json({ ok: true })
}
