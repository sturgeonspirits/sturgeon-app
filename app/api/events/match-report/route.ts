// ─────────────────────────────────────────────
// Changelog
//   v2026-06-03.1 — New: player self-reported per-match cribbage scores.
//                   Upserts one match report, recomputes the player's nightly
//                   leaderboard_events total, awards attendance once.
// ─────────────────────────────────────────────
/**
 * POST /api/events/match-report
 * A signed-in player self-reports the result of ONE of their 3 cribbage matches
 * for the night. We trust the player — the score counts immediately. The
 * opponent reports their own mirror result; agreement/conflict is surfaced in
 * the UI but never gates the running total.
 *
 * Body: { periodId, matchNumber (1-3), opponentId, won, spread }
 */
import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { emitEarnEvent, completeMission } from '@/lib/earn-events'

export async function POST(req: NextRequest) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to report a score' }, { status: 401 })

  try {
    const body = await req.json()
    const { periodId, matchNumber, opponentId, won, spread = 0 } = body

    if (!periodId || !opponentId) return NextResponse.json({ error: 'Missing periodId or opponentId' }, { status: 400 })
    const mn = parseInt(String(matchNumber), 10)
    if (!(mn >= 1 && mn <= 3)) return NextResponse.json({ error: 'matchNumber must be 1, 2 or 3' }, { status: 400 })
    if (typeof won !== 'boolean') return NextResponse.json({ error: 'won must be true or false' }, { status: 400 })
    if (opponentId === user.id) return NextResponse.json({ error: 'You can’t play yourself' }, { status: 400 })
    const spreadNum = parseInt(String(spread), 10) || 0

    const supabase = createServiceClient()

    // Validate the period is open
    const { data: period } = await supabase
      .from('leaderboard_periods')
      .select('id, is_finalized, event_type_id')
      .eq('id', periodId)
      .maybeSingle()
    if (!period) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    if (period.is_finalized) return NextResponse.json({ error: 'This event has already ended' }, { status: 410 })

    const { data: eventType } = await supabase
      .from('event_types')
      .select('*')
      .eq('id', period.event_type_id)
      .maybeSingle()
    if (!eventType) return NextResponse.json({ error: 'Event type not found' }, { status: 404 })

    // Both players must be registered for this night.
    const { data: registered } = await supabase
      .from('leaderboard_events')
      .select('user_id, wins, losses, score')
      .eq('period_id', periodId)
      .in('user_id', [user.id, opponentId])

    const myRow       = (registered ?? []).find((r: any) => r.user_id === user.id)
    const opponentReg = (registered ?? []).some((r: any) => r.user_id === opponentId)
    if (!myRow)       return NextResponse.json({ error: 'Sign up for this night before reporting a score' }, { status: 403 })
    if (!opponentReg) return NextResponse.json({ error: 'Your opponent isn’t signed up for this night yet' }, { status: 400 })

    // Upsert this player's report for the chosen match slot.
    const { error: reportErr } = await supabase
      .from('cribbage_match_reports')
      .upsert({
        period_id:    periodId,
        reporter_id:  user.id,
        opponent_id:  opponentId,
        match_number: mn,
        won,
        spread:       spreadNum,
        updated_at:   new Date().toISOString(),
      }, { onConflict: 'period_id,reporter_id,match_number' })
    if (reportErr) throw new Error(`Could not save report: ${reportErr.message}`)

    // Recompute this player's nightly aggregate from their own reports.
    const { data: myReports } = await supabase
      .from('cribbage_match_reports')
      .select('won, spread')
      .eq('period_id', periodId)
      .eq('reporter_id', user.id)

    const wins   = (myReports ?? []).filter((r: any) => r.won).length
    const losses = (myReports ?? []).filter((r: any) => !r.won).length
    const score  = (myReports ?? []).reduce((s: number, r: any) => s + (r.spread ?? 0), 0)

    const { error: aggErr } = await supabase
      .from('leaderboard_events')
      .upsert({
        period_id:  periodId,
        user_id:    user.id,
        wins,
        losses,
        score,
        entered_by: user.id,
        entered_at: new Date().toISOString(),
      }, { onConflict: 'period_id,user_id' })
    if (aggErr) throw new Error(`Could not update standings: ${aggErr.message}`)

    // Award attendance points once — only the first time this player records a result.
    const hadScores = (myRow.wins ?? 0) > 0 || (myRow.losses ?? 0) > 0 || (myRow.score ?? 0) !== 0
    if (!hadScores) {
      const placementPoints = (eventType.placement_points ?? {}) as Record<string, number>
      const pts = placementPoints['attend'] ?? placementPoints['participant'] ?? 15
      if (pts > 0) {
        await emitEarnEvent({
          userId:      user.id,
          eventType:   'leaderboard_awarded',
          pointsDelta: pts,
          contextType: 'leaderboard_period',
          contextId:   periodId,
          notes:       `${eventType.name}: Attended`,
          supabase,
        })
      }
      if (eventType.participation_mission_slug) {
        try {
          await completeMission({ userId: user.id, missionSlug: eventType.participation_mission_slug, supabase })
        } catch (e) {
          console.warn('participation mission skip:', (e as Error).message)
        }
      }
    }

    try { revalidateTag(`leaderboard-${period.event_type_id}`) } catch {}

    return NextResponse.json({ ok: true, wins, losses, score })
  } catch (err: any) {
    console.error('Match report error:', err)
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 })
  }
}
