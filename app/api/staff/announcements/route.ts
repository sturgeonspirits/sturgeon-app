// ─────────────────────────────────────────────
// Changelog
//   v2026-04-25.1 — Initial route. Staff list/send announcements (manual only).
// ─────────────────────────────────────────────

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

// Mirrors the staff guard in /api/push/send. Throws on unauthenticated/forbidden.
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

// GET /api/staff/announcements
// Returns the most recent 50 announcements (audit history).
export async function GET() {
  try {
    await assertStaff()
  } catch (e: any) {
    const code = e.message === 'Unauthenticated' ? 401 : 403
    return NextResponse.json({ error: e.message }, { status: code })
  }

  const service = createServiceClient()
  const { data, error } = await (service as any)
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Best-effort enrich with sender display name. Done as a separate fetch to
  // sidestep PostgREST FK cache issues (same pattern as /staff/missions).
  const senderIds: string[] = Array.from(new Set((data ?? []).map((a: any) => a.sent_by as string).filter(Boolean)))
  let senderMap: Record<string, { display_name: string | null; full_name: string | null }> = {}
  if (senderIds.length) {
    const { data: profiles } = await service
      .from('profiles')
      .select('id, display_name, full_name')
      .in('id', senderIds)
    senderMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]))
  }

  const enriched = (data ?? []).map((a: any) => ({
    ...a,
    sender: a.sent_by ? senderMap[a.sent_by] ?? null : null,
  }))

  return NextResponse.json({ announcements: enriched })
}

// POST /api/staff/announcements
// Body: { title, body, url?, tag?, target?: { type: 'all' } }
// Sends a push to every saved subscription matching the target, then records
// the send in the announcements table. Manual only — no scheduler hits this.
export async function POST(req: NextRequest) {
  initWebPush()

  let user
  try {
    user = await assertStaff()
  } catch (e: any) {
    const code = e.message === 'Unauthenticated' ? 401 : 403
    return NextResponse.json({ error: e.message }, { status: code })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const title  = (body.title ?? '').toString().trim()
  const text   = (body.body  ?? '').toString().trim()
  const url    = (body.url   ?? '/').toString().trim() || '/'
  const tag    = body.tag ? body.tag.toString().trim() : null
  const target = body.target ?? { type: 'all' }

  if (!title || !text) {
    return NextResponse.json({ error: 'title and body are required' }, { status: 400 })
  }
  if (title.length > 120) {
    return NextResponse.json({ error: 'title must be 120 characters or fewer' }, { status: 400 })
  }
  if (text.length > 400) {
    return NextResponse.json({ error: 'body must be 400 characters or fewer' }, { status: 400 })
  }
  // Only 'all' is supported today. Reject unknown targets up front so the
  // shape of the audit log stays clean.
  if (target?.type !== 'all') {
    return NextResponse.json({ error: 'Unsupported target type' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: subs, error: subsErr } = await service
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')

  if (subsErr) return NextResponse.json({ error: subsErr.message }, { status: 500 })

  const subscriberCount = subs?.length ?? 0
  let sent = 0
  let failed = 0
  const expired: string[] = []

  if (subscriberCount > 0) {
    const payload = JSON.stringify({
      title,
      body: text,
      url,
      tag: tag || `announcement-${Date.now()}`,
    })

    await Promise.all(subs!.map(async (sub: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        )
        sent++
      } catch (e: any) {
        failed++
        // 410 Gone / 404 Not Found = subscription dead, prune it.
        if (e.statusCode === 410 || e.statusCode === 404) expired.push(sub.endpoint)
      }
    }))

    if (expired.length) {
      await service.from('push_subscriptions').delete().in('endpoint', expired)
    }
  }

  // Record the send. We log even when subscriberCount is 0 so staff can see
  // that they tried and there was nobody listening.
  const { data: inserted, error: insErr } = await (service as any)
    .from('announcements')
    .insert({
      sent_by:          user.id,
      title,
      body:             text,
      url,
      tag,
      target,
      subscriber_count: subscriberCount,
      sent_count:       sent,
      failed_count:     failed,
      expired_count:    expired.length,
    })
    .select('id, created_at')
    .single()

  if (insErr) {
    // Push already went out; surface the row error but don't pretend nothing
    // happened — return delivery counts so the UI can show what shipped.
    return NextResponse.json({
      ok: true,
      logged: false,
      logError: insErr.message,
      subscriberCount,
      sent,
      failed,
      expired: expired.length,
    })
  }

  return NextResponse.json({
    ok: true,
    logged: true,
    id: inserted.id,
    createdAt: inserted.created_at,
    subscriberCount,
    sent,
    failed,
    expired: expired.length,
  })
}
