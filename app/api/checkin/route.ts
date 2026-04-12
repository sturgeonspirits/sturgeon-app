/**
 * POST /api/checkin
 * Validates the daily HMAC token and awards check-in points.
 * Prevents duplicate check-ins within a 24-hour rolling window.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { validateDailyToken, localDate } from '@/lib/checkin-token'
import { emitEarnEvent } from '@/lib/earn-events'

const CHECKIN_POINTS = 15

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { token } = body as { token?: string }

    if (!token || !validateDailyToken(token)) {
      return NextResponse.json(
        { error: 'Invalid or expired check-in code. Ask a staff member for a fresh QR.' },
        { status: 401 },
      )
    }

    // Require auth
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Please sign in to check in.' }, { status: 401 })
    }

    const service = createServiceClient()

    // Duplicate check — one check-in per 24-hour window.
    // The daily token also rotates at midnight Chicago time, so the window
    // and the token expiry are naturally aligned.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: existing } = await service
      .from('earn_events')
      .select('id')
      .eq('user_id', user.id)
      .eq('event_type', 'bar_checkin')
      .gte('created_at', since)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'You\'ve already checked in today — see you next time!' },
        { status: 409 },
      )
    }

    // Award points
    const earnEvent = await emitEarnEvent({
      userId:      user.id,
      eventType:   'bar_checkin',
      pointsDelta: CHECKIN_POINTS,
      contextType: 'checkin',
      notes:       `Bar check-in ${localDate(0)}`,
      supabase:    service,
    })

    // ── Birthday detection ────────────────────────────────────────
    // If today is the customer's birthday, auto-create a pending
    // Birthday Cocktail redemption so staff sees it in the queue.
    let birthdayCocktail = false
    try {
      const { data: profile } = await service
        .from('profiles')
        .select('birthday')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.birthday) {
        // Today's MM/DD in Chicago local time
        const chicagoDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
        const [, mm, dd]  = chicagoDate.split('-')
        const todayMD     = `${mm}/${dd}`

        if ((profile.birthday as string) === todayMD) {
          // Find the birthday cocktail reward by name
          const { data: reward } = await service
            .from('rewards')
            .select('id')
            .ilike('name', '%birthday%')
            .eq('is_active', true)
            .limit(1)
            .maybeSingle()

          if (reward) {
            // Only once per calendar year
            const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString()
            const { data: alreadyClaimed } = await service
              .from('reward_redemptions')
              .select('id')
              .eq('user_id', user.id)
              .eq('reward_id', (reward as any).id)
              .gte('created_at', yearStart)
              .limit(1)

            if (!alreadyClaimed || alreadyClaimed.length === 0) {
              // 30-day expiry — they can redeem even if they come back later
              const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
              await service.from('reward_redemptions').insert({
                user_id:    user.id,
                reward_id:  (reward as any).id,
                status:     'pending',
                expires_at: expires,
                notes:      `Birthday cocktail 🎂 — auto-created at check-in`,
              })
              birthdayCocktail = true
            }
          }
        }
      }
    } catch (bdErr) {
      // Non-fatal — birthday failure should never block a check-in
      console.warn('[checkin] birthday check failed:', (bdErr as Error).message)
    }

    return NextResponse.json({ success: true, pointsEarned: earnEvent.points_delta, birthdayCocktail })
  } catch (err: any) {
    console.error('[/api/checkin] error:', err)
    return NextResponse.json({ error: 'Server error — please try again.' }, { status: 500 })
  }
}
