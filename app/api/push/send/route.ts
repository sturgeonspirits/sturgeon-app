// ─────────────────────────────────────────────
// Changelog
//   v2026-07-13.1 — Paginate the subscriptions fetch via fetchAllRows: PostgREST
//                   caps responses at 1,000 rows, so "send to all" pushes would
//                   silently skip subscribers beyond the first 1,000.
// ─────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
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

  // Fetch subscriptions (paginated — "send to all" can exceed 1,000 rows)
  let subs: any[]
  try {
    subs = await fetchAllRows((from, to) => {
      let q = service.from('push_subscriptions').select('*')
      if (userIds?.length) q = q.in('user_id', userIds)
      return q.order('endpoint').range(from, to)
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
  if (!subs.length) return NextResponse.json({ ok: true, sent: 0, message: 'No subscribers found' })

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
      // Fire-and-forget: update last_used_at — non-fatal if it fails, and
      // deliberately outside the send try/catch so a DB error never inflates
      // the failed count or marks a live endpoint as expired.
      service.from('push_subscriptions')
        .update({ last_used_at: new Date().toISOString() })
        .eq('endpoint', sub.endpoint)
        .then(() => {}, () => {})
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
