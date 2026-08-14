// ─────────────────────────────────────────────
// Changelog
//   v2026-08-14.1 — Roster members rank normally but take no placement bonus
//                   (they can't earn points). Also refuse to finalize a period
//                   twice: with an all-roster podium no earn_events are written,
//                   so the "already awarded" probe alone was no longer enough.
// ─────────────────────────────────────────────
/**
 * POST /api/staff/finalize-night
 * After all scores are entered for a cribbage/individual night,
 * rank players and award placement bonuses:
 *   1st place: +50 pts
 *   2nd place: +30 pts
 * Also marks the period as finalized.
 *
 * For wins_losses (cribbage): rank by wins DESC, spread (score) DESC.
 * For points (individual trivia): rank by score DESC.
 */
import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import { emitEarnEvent, completeMission, rosterMemberIds } from '@/lib/earn-events'
import { requireStaff } from '@/lib/staff-auth'

export async function POST(req: NextRequest) {
  const auth = await requireStaff()
  if (auth instanceof Response) return auth

  try {
    const { periodId } = await req.json()
    if (!periodId) return NextResponse.json({ error: 'periodId required' }, { status: 400 })

    const supabase = createServiceClient()

    // Fetch period
    const { data: period } = await supabase
      .from('leaderboard_periods')
      .select('*')
      .eq('id', periodId)
      .single()

    if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 404 })
    if (period.is_finalized) {
      return NextResponse.json({ error: 'This night has already been finalized' }, { status: 409 })
    }

    // Fetch event type
    const { data: eventType } = await supabase
      .from('event_types')
      .select('*')
      .eq('id', period.event_type_id)
      .single()

    if (!eventType) return NextResponse.json({ error: 'Event type not found' }, { status: 404 })

    const placementPoints = eventType.placement_points as Record<string, number>
    const firstBonus  = placementPoints['1st_bonus'] ?? 50
    const secondBonus = placementPoints['2nd_bonus'] ?? 30

    // Check if placement bonuses were already awarded for this period
    const { data: existingBonuses } = await supabase
      .from('earn_events')
      .select('id')
      .eq('context_type', 'leaderboard_period')
      .eq('context_id', periodId)
      .like('notes', '%placement bonus%')
      .limit(1)

    if (existingBonuses && existingBonuses.length > 0) {
      return NextResponse.json({ error: 'Placement bonuses already awarded for this night' }, { status: 409 })
    }

    // Get all scored players for this period, ranked
    const { data: allEntries } = await supabase
      .from('leaderboard_events')
      .select('user_id, wins, losses, score')
      .eq('period_id', periodId)
      .or('wins.gt.0,losses.gt.0,score.neq.0')

    if (!allEntries || allEntries.length === 0) {
      return NextResponse.json({ error: 'No scored players found' }, { status: 400 })
    }

    // Rank: for wins_losses → wins DESC, spread (score) DESC
    //        for points → score DESC
    const ranked = [...allEntries].sort((a, b) => {
      if (eventType.scoring_method === 'wins_losses') {
        if ((b.wins ?? 0) !== (a.wins ?? 0)) return (b.wins ?? 0) - (a.wins ?? 0)
        return (b.score ?? 0) - (a.score ?? 0) // spread as tiebreaker
      }
      return (b.score ?? 0) - (a.score ?? 0)
    })

    const results: { userId: string; place: number; bonus: number; roster?: boolean }[] = []

    // Roster members (name-only, no login) place normally but earn nothing.
    const rosterIds = await rosterMemberIds(ranked.map(r => r.user_id), supabase)

    // Award 1st place
    if (ranked.length >= 1) {
      const first = ranked[0]
      const firstIsRoster = rosterIds.has(first.user_id)
      if (!firstIsRoster) {
        await emitEarnEvent({
          userId: first.user_id,
          eventType: 'leaderboard_awarded',
          pointsDelta: firstBonus,
          contextType: 'leaderboard_period',
          contextId: periodId,
          notes: `${eventType.name}: 1st place placement bonus`,
          supabase,
        })
      }
      results.push({
        userId: first.user_id,
        place:  1,
        bonus:  firstIsRoster ? 0 : firstBonus,
        roster: firstIsRoster,
      })

      // Win mission
      if (eventType.win_mission_slug && !firstIsRoster) {
        try {
          await completeMission({ userId: first.user_id, missionSlug: eventType.win_mission_slug, supabase })
        } catch (e) {
          console.warn('win mission skip:', (e as Error).message)
        }
      }
    }

    // Award 2nd place
    if (ranked.length >= 2) {
      const second = ranked[1]
      const secondIsRoster = rosterIds.has(second.user_id)
      if (!secondIsRoster) {
        await emitEarnEvent({
          userId: second.user_id,
          eventType: 'leaderboard_awarded',
          pointsDelta: secondBonus,
          contextType: 'leaderboard_period',
          contextId: periodId,
          notes: `${eventType.name}: 2nd place placement bonus`,
          supabase,
        })
      }
      results.push({
        userId: second.user_id,
        place:  2,
        bonus:  secondIsRoster ? 0 : secondBonus,
        roster: secondIsRoster,
      })

      // 2nd place also gets win mission
      if (eventType.win_mission_slug && !secondIsRoster) {
        try {
          await completeMission({ userId: second.user_id, missionSlug: eventType.win_mission_slug, supabase })
        } catch (e) {
          console.warn('win mission skip (2nd):', (e as Error).message)
        }
      }
    }

    // Mark period as finalized
    await supabase
      .from('leaderboard_periods')
      .update({ is_finalized: true })
      .eq('id', periodId)

    // Bust cache
    try {
      revalidateTag(`leaderboard-${period.event_type_id}`)
    } catch (e) {
      console.warn('revalidateTag failed:', (e as Error).message)
    }

    // Fetch names for the response
    const userIds = results.map(r => r.userId)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, full_name')
      .in('id', userIds)

    const profileMap: Record<string, string> = {}
    for (const p of (profiles ?? [])) {
      profileMap[p.id] = p.display_name ?? p.full_name ?? 'Unknown'
    }

    return NextResponse.json({
      success: true,
      placements: results.map(r => ({
        ...r,
        name: profileMap[r.userId] ?? 'Unknown',
      })),
    })
  } catch (err: any) {
    console.error('Finalize night error:', err)
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 })
  }
}
