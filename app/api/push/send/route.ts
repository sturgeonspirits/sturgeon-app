import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import webpush from 'web-push'

function initWebPush() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )
}

async function assertStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')
  const role: string = (user as any).app_metadata?.role ?? ''
  if (['staff', 'admin'].includes(role)) return user
  const service = createServiceClient()
  const { data } = await service.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!['staff', 'admin'].includes(data?.role ?? '')) throw new Error('Forbidden')
  return user
}

// POST /api/push/send
// Send a push notification to a set of user IDs (or all subscribers).
// Body: { userIds?: string[], title: string, body: string, url?: string, tag?: string }
export async function POST(req: NextRequest) {
  initWebPush()
  try {
    await assertStaff()
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 })
  }

  const service = createServiceClient()
  const { userIds, title, body, url = '/', tag } = await req.json()

  if (!title || !body) {
    return NextResponse.json({ error: 'title and body required' }, { status: 400 })
  }

  // Fetch subscriptions
  let query = service.from('push_subscriptions').select('*')
  if (userIds?.length) query = query.in('user_id', userIds)

  const { data: subs, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!subs?.length) return NextResponse.json({ ok: true, sent: 0, message: 'No subscribers found' })

  const payload = JSON.stringify({ title, body, url, tag: tag || 'sturgeon-event' })
  let sent = 0
  let failed = 0
  const expired: string[] = []

  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
      sent++
      // Update last_used_at
      await service.from('push_subscriptions')
        .update({ last_used_at: new Date().toISOString() })
        .eq('endpoint', sub.endpoint)
    } catch (e: any) {
      failed++
      // 410 Gone = subscription expired, clean it up
      if (e.statusCode === 410 || e.statusCode === 404) {
        expired.push(sub.endpoint)
      }
    }
  }))

  // Remove expired subscriptions
  if (expired.length) {
    await service.from('push_subscriptions').delete().in('endpoint', expired)
  }

  return NextResponse.json({ ok: true, sent, failed, expired: expired.length })
}
