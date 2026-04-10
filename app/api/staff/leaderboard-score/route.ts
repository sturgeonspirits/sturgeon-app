/**
 * POST /api/staff/leaderboard-score
 * Submit scores for any event type. Handles wins_losses, points, and placement (team).
 * After saving, runs the reward check pass automatically.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { emitEarnEvent, completeMission } from '@/lib/earn-events'
import { requireStaff } from '@/lib/staff-auth'

export async function POST(req: NextRequest) {
  const auth = await requireStaff()
  if (auth instanceof Response) return auth

  try {
    const body = await req.json()
    // replaceMode: when true, wins/losses/spread REPLACE the existing row
    // (used by the inline sign-up score block so staff can click Edit → Save
    // without doubling). Default false = accumulate across matches.
    const { periodId, scoringMethod, staffId, entries = [], teams = [], replaceMode = false } = body

    const supabase = createServiceClient()

    // Fetch period + event_type config (separate queries to avoid PostgREST FK cache issues)
    const { data: period } = await supabase
      .from('leaderboard_periods')
      .select('*')
      .eq('id', periodId)
      .single()

    if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 404 })

    const { data: eventType } = await supabase
      .from('event_types')
      .select('*')
      .eq('id', period.event_type_id)
      .single()

    if (!eventType) return NextResponse.json({ error: 'Event type not found' }, { status: 404 })
    const placementPoints = eventType.placement_points as Record<string, number>

    const results: any[] = []

    // ── Individual scoring (wins_losses or points) ────────
    if (scoringMethod !== 'placement' || teams.length === 0) {
      for (const entry of entries) {
        const { userId, score = 0, wins = 0, losses = 0, spread = 0 } = entry

        // For wins_losses, we ACCUMULATE across matches in a period.
        // Fetch the existing row first, then add to it.
        const { data: existing } = await supabase
          .from('leaderboard_events')
          .select('wins, losses, score')
          .eq('period_id', periodId)
          .eq('user_id', userId)
          .maybeSingle()

        const newWins   = replaceMode ? wins   : (existing?.wins   ?? 0) + wins
        const newLosses = replaceMode ? losses : (existing?.losses ?? 0) + losses
        // For wins_losses: score field stores cumulative point spread (unless replaceMode)
        // For points: score field stores the raw score (replace, not add)
        const newScore  = scoringMethod === 'wins_losses'
          ? (replaceMode ? spread : (existing?.score ?? 0) + spread)
          : score

        // Upsert leaderboard_events row
        const { error: upsertErr } = await supabase
          .from('leaderboard_events')
          .upsert({
            period_id:  periodId,
            user_id:    userId,
            score:      newScore,
            wins:       newWins,
            losses:     newLosses,
            entered_by: staffId,
            entered_at: new Date().toISOString(),
          }, { onConflict: 'period_id,user_id' })

        if (upsertErr) throw new Error(`Score save failed for user ${userId}: ${upsertErr.message}`)

        // Award points
        // In replaceMode (inline edits), only award points when scores are
        // being entered for the first time (existing row was all zeros).
        // This prevents double-awarding when staff edits an existing entry.
        const existingHadScores = (existing?.wins ?? 0) > 0
                                || (existing?.losses ?? 0) > 0
                                || (existing?.score ?? 0) !== 0
        let pts = 0
        if (replaceMode && existingHadScores) {
          pts = 0   // already awarded on the original submission
        } else if (scoringMethod === 'wins_losses') {
          pts = wins > 0
            ? (placementPoints['win'] ?? 10)   // cribbage win = 10 pts
            : (placementPoints['loss'] ?? 5)   // cribbage loss = 5 pts (still participated)
        } else {
          pts = placementPoints['participant'] ?? 15  // trivia/other participation = 15 pts
        }

        if (pts > 0) {
          const earnEvent = await emitEarnEvent({
            userId,
            eventType: 'leaderboard_awarded',
            pointsDelta: pts,
            contextType: 'leaderboard_period',
            contextId: periodId,
            notes: `${eventType.name}: ${scoringMethod === 'wins_losses' ? (wins > 0 ? 'Win' : 'Loss') : `${score} pts`}`,
            supabase,
          })
          results.push({ userId, pts, earnEventId: earnEvent.id })
        }

        // Mission: participation (non-fatal — mission may not exist yet)
        if (eventType.participation_mission_slug) {
          try {
            await completeMission({ userId, missionSlug: eventType.participation_mission_slug, supabase })
          } catch (e) {
            console.warn('participation mission skip:', (e as Error).message)
          }
        }
        // Mission: win (non-fatal)
        if (wins > 0 && eventType.win_mission_slug) {
          try {
            await completeMission({ userId, missionSlug: eventType.win_mission_slug, supabase })
          } catch (e) {
            console.warn('win mission skip:', (e as Error).message)
          }
        }
      }
    }

    // ── Team scoring (placement) ─────────────────────────
    for (const team of teams) {
      const { name, score, placement, memberIds } = team

      // Always upsert into permanent_teams so teams are discoverable for sign-up
      const { data: permTeam } = await supabase
        .from('permanent_teams')
        .upsert(
          { event_type_id: period.event_type_id, name },
          { onConflict: 'event_type_id,name', ignoreDuplicates: false }
        )
        .select('id')
        .single()

      const { data: teamRow } = await supabase
        .from('leaderboard_teams')
        .insert({ period_id: periodId, name, score, placement, permanent_team_id: permTeam?.id ?? null })
        .select()
        .single()

      // Insert team members
      if (teamRow && memberIds?.length) {
        await supabase.from('leaderboard_team_members').insert(
          memberIds.map((uid: string) => ({ team_id: teamRow.id, user_id: uid }))
        )

        // Also write individual leaderboard_events rows for each member so the
        // individual standings page auto-populates — no separate data entry needed.
        for (const userId of memberIds) {
          const { error: teamUpsertErr } = await supabase.from('leaderboard_events').upsert({
            period_id:  periodId,
            user_id:    userId,
            score:      score,
            placement:  placement,
            entered_by: staffId,
            entered_at: new Date().toISOString(),
          }, { onConflict: 'period_id,user_id' })
          if (teamUpsertErr) throw new Error(`Team score save failed: ${teamUpsertErr.message}`)
        }

        // Award points to each team member
        // placement_points JSON: { "1": 65, "2": 40, "participant": 15 }
        // 1st = 50 bonus + 15 participation = 65, 2nd = 25 + 15 = 40, others = 15
        const pts = placementPoints[String(placement)] ?? placementPoints['participant'] ?? 15
        for (const userId of memberIds) {
          if (pts > 0) {
            await emitEarnEvent({
              userId,
              eventType: 'leaderboard_awarded',
              pointsDelta: pts,
              contextType: 'leaderboard_period',
              contextId: periodId,
              notes: `${eventType.name}: Team "${name}" — ${placement === 1 ? '1st' : placement === 2 ? '2nd' : placement === 3 ? '3rd' : `${placement}th`} place`,
              supabase,
            })
          }
          if (eventType.participation_mission_slug) {
            try {
              await completeMission({ userId, missionSlug: eventType.participation_mission_slug, supabase })
            } catch (e) {
              console.warn('participation mission skip (team):', (e as Error).message)
            }
          }
          if (placement === 1 && eventType.win_mission_slug) {
            try {
              await completeMission({ userId, missionSlug: eventType.win_mission_slug, supabase })
            } catch (e) {
              console.warn('win mission skip (team):', (e as Error).message)
            }
          }
          results.push({ userId, pts })
        }
      }
    }

    // ── Reward check pass ────────────────────────────────
    await runRewardCheckPass({ periodId, eventType, entries, teams, supabase })

    return NextResponse.json({ success: true, results })
  } catch (err: any) {
    console.error('Leaderboard score error:', err)
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 })
  }
}

/**
 * After scores are saved, check all active leaderboard rewards
 * and create pending redemptions for anyone who qualifies.
 */
async function runRewardCheckPass({
  periodId, eventType, entries, teams, supabase
}: {
  periodId: string; eventType: any; entries: any[]; teams: any[]; supabase: any
}) {
  const { data: rewards } = await supabase
    .from('rewards')
    .select('*')
    .eq('is_active', true)
    .in('redemption_method', ['leaderboard', 'milestone', 'streak'])

  if (!rewards) return

  // Collect all user IDs involved in this submission
  const entryUserIds = entries.map((e: any) => e.userId)
  const teamUserIds  = teams.flatMap((t: any) => t.memberIds ?? [])
  const allUserIds   = [...new Set([...entryUserIds, ...teamUserIds])]

  for (const reward of rewards) {
    const params = reward.trigger_params as any

    // Only check rewards relevant to this event type
    if (params.event_type_slug && params.event_type_slug !== eventType.slug) continue

    if (reward.redemption_method === 'leaderboard') {
      // Award to users who achieved min_placement
      const minPlacement = params.min_placement ?? 1

      // Individual winners
      const winners = entries.filter((e: any) => e.placement <= minPlacement || e.wins > 0)
      // Team winners
      const winningTeams = teams.filter((t: any) => t.placement <= minPlacement)
      const teamWinnerIds = winningTeams.flatMap((t: any) => t.memberIds ?? [])

      for (const userId of [...winners.map((e: any) => e.userId), ...teamWinnerIds]) {
        await createPendingRedemption({ userId, rewardId: reward.id, supabase })
      }
    }

    // milestone and streak checks would query leaderboard_cache here
    // (implement in Phase 2 when cache is populated)
  }
}

async function createPendingRedemption({
  userId, rewardId, supabase
}: {
  userId: string; rewardId: string; supabase: any
}) {
  // Don't create duplicate pending redemptions
  const { data: existing } = await supabase
    .from('reward_redemptions')
    .select('id')
    .eq('user_id', userId)
    .eq('reward_id', rewardId)
    .eq('status', 'pending')
    .limit(1)

  if (existing && existing.length > 0) return

  await supabase.from('reward_redemptions').insert({
    user_id:   userId,
    reward_id: rewardId,
    status:    'pending',
  })
}
