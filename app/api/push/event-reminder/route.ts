import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import webpush from 'web-push'

function initWebPush() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )
}

// POST /api/push/event-reminder
// Called by the scheduled task. Finds events in the next 2 days,
// looks up who attended the last occurrence of each event type,
// and sends push reminders to those users (if they have subscriptions).
//
// Auth: requires CRON_SECRET header (set in env) to prevent public access.
export async function POST(req: NextRequest) {
  initWebPush()
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()

  // Find events in the next 1–3 days
  const today    = new Date()
  const fromDate = new Date(today); fromDate.setDate(today.getDate() + 1)
  const toDate   = new Date(today); toDate.setDate(today.getDate() + 3)

  const fromStr = fromDate.toISOString().split('T')[0]
  const toStr   = toDate.toISOString().split('T')[0]

  // Fetch events and event_types separately to avoid PostgREST FK cache issues
  const [{ data: upcomingEvents }, { data: allEventTypes }] = await Promise.all([
    service
      .from('events')
      .select('id, event_type_id, event_date, start_time')
      .gte('event_date', fromStr)
      .lte('event_date', toStr)
      .order('event_date'),
    service
      .from('event_types')
      .select('id, name, slug, icon')
      .eq('is_active', true),
  ])

  if (!upcomingEvents?.length) {
    return NextResponse.json({ ok: true, message: 'No upcoming events', sent: 0 })
  }

  const etById = Object.fromEntries((allEventTypes ?? []).map((et: any) => [et.id, et]))

  let totalSent    = 0
  let totalFailed  = 0
  const log: any[] = []

  for (const event of upcomingEvents) {
    const et = etById[event.event_type_id ?? '']
    if (!et) continue

    // Find the most recent leaderboard_period for this event type (excluding today's)
    const { data: lastPeriod } = await service
      .from('leaderboard_periods')
      .select('id')
      .eq('event_type_id', event.event_type_id ?? '')
      .lt('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!lastPeriod) {
      log.push({ event: et.name, date: event.event_date, skip: 'no previous period' })
      continue
    }

    // Get participants from last occurrence
    const { data: lastParticipants } = await service
      .from('leaderboard_events')
      .select('user_id')
      .eq('period_id', lastPeriod.id)

    const userIds = [...new Set((lastParticipants ?? []).map(p => p.user_id))]
    if (!userIds.length) {
      log.push({ event: et.name, date: event.event_date, skip: 'no previous participants' })
      continue
    }

    // Get push subscriptions for these users
    const { data: subs } = await service
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, user_id')
      .in('user_id', userIds)

    if (!subs?.length) {
      log.push({ event: et.name, date: event.event_date, skip: 'no subscriptions', users: userIds.length })
      continue
    }

    // Format the event date
    const [yr, mo, dy] = event.event_date.split('-').map(Number)
    const d = new Date(yr, mo - 1, dy)
    const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

    const timeStr = event.start_time
      ? (() => {
          const [h, m] = event.start_time.split(':').map(Number)
          const t = new Date(yr, mo - 1, dy, h, m)
          return ' at ' + t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        })()
      : ''

    const payload = JSON.stringify({
      title: `${et.icon ?? '🍸'} ${et.name} — ${dateStr}`,
      body:  `You're invited back! ${et.name}${timeStr}. Tap to see details.`,
      url:   '/events',
      tag:   `event-reminder-${event.id}`,
    })

    let sent = 0, failed = 0
    const expired: string[] = []

    await Promise.all(subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        sent++
      } catch (e: any) {
        failed++
        if (e.statusCode === 410 || e.statusCode === 404) expired.push(sub.endpoint)
      }
    }))

    if (expired.length) {
      await service.from('push_subscriptions').delete().in('endpoint', expired)
    }

    totalSent   += sent
    totalFailed += failed
    log.push({ event: et.name, date: event.event_date, users: userIds.length, subscribed: subs.length, sent, failed })
  }

  return NextResponse.json({ ok: true, totalSent, totalFailed, log })
}
