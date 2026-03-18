/**
 * Central earn event service.
 *
 * RULE: Every points-affecting action flows through emitEarnEvent().
 * Never INSERT directly into points_ledger or update a balance column.
 * The DB trigger handles ledger sync automatically.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import type { Database, EarnEvent, EarnEventType } from './supabase/types'

type Client = SupabaseClient<Database>

export interface EmitEarnEventParams {
  userId: string
  eventType: EarnEventType
  pointsDelta: number
  contextType?: string      // 'mission' | 'leaderboard_period' | 'journal_entry' | 'reward'
  contextId?: string        // UUID of the relevant row
  locationId?: string
  notes?: string
  supabase: Client
}

/**
 * Insert an earn_event and let the DB trigger update points_ledger.
 * After insert, recalculates tier in case the user crossed a threshold.
 */
export async function emitEarnEvent(params: EmitEarnEventParams): Promise<EarnEvent> {
  const { userId, eventType, pointsDelta, contextType, contextId, locationId, notes, supabase } = params

  const { data, error } = await supabase
    .from('earn_events')
    .insert({
      user_id:      userId,
      event_type:   eventType,
      points_delta: pointsDelta,
      context_type: contextType ?? null,
      context_id:   contextId   ?? null,
      location_id:  locationId  ?? null,
      notes:        notes       ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(`emitEarnEvent failed: ${error.message}`)

  // Recalculate tier (no-op if no threshold crossed)
  await supabase.rpc('recalculate_tier', { p_user_id: userId })

  return data as EarnEvent
}

// ─── Mission helpers ─────────────────────────────────────────

export interface CompleteMissionParams {
  userId: string
  missionSlug: string
  completedBy?: string   // staff user_id if manual completion
  locationId?: string
  notes?: string
  supabase: Client
}

/**
 * Mark a mission complete, emit the earn_event, and check if any challenge
 * is now fully complete for this user.
 */
export async function completeMission(params: CompleteMissionParams): Promise<EarnEvent | null> {
  const { userId, missionSlug, completedBy, locationId, notes, supabase } = params

  // 1. Fetch mission
  const { data: mission, error: mErr } = await supabase
    .from('missions')
    .select('*')
    .eq('slug', missionSlug)
    .eq('is_active', true)
    .single()

  if (mErr || !mission) throw new Error(`Mission not found: ${missionSlug}`)

  // 2. Check if already completed (for non-repeatable missions)
  if (!mission.is_repeatable) {
    const { data: existing } = await supabase
      .from('mission_completions')
      .select('id')
      .eq('user_id', userId)
      .eq('mission_id', mission.id)
      .limit(1)

    if (existing && existing.length > 0) return null // already done
  }

  // 3. Emit earn event
  const earnEvent = await emitEarnEvent({
    userId,
    eventType: 'mission_completed',
    pointsDelta: mission.points,
    contextType: 'mission',
    contextId: mission.id,
    locationId,
    notes: notes ?? `Mission: ${mission.title}`,
    supabase,
  })

  // 4. Record the completion
  await supabase.from('mission_completions').insert({
    user_id:       userId,
    mission_id:    mission.id,
    earn_event_id: earnEvent.id,
    completed_by:  completedBy ?? null,
    notes:         notes ?? null,
  })

  // 5. Check challenges
  await checkAndCompleteChallenges({ userId, supabase })

  return earnEvent
}

// ─── Challenge completion check ──────────────────────────────

async function checkAndCompleteChallenges({ userId, supabase }: { userId: string; supabase: Client }) {
  // Fetch active challenges the user hasn't completed yet
  const { data: challenges } = await supabase
    .from('challenges')
    .select('*, challenge_missions(mission_id)')
    .eq('is_active', true)

  if (!challenges) return

  const { data: userCompletions } = await supabase
    .from('mission_completions')
    .select('mission_id')
    .eq('user_id', userId)

  const completedMissionIds = new Set((userCompletions ?? []).map(c => c.mission_id))

  const { data: completedChallenges } = await supabase
    .from('challenge_completions')
    .select('challenge_id')
    .eq('user_id', userId)

  const completedChallengeIds = new Set((completedChallenges ?? []).map(c => c.challenge_id))

  for (const challenge of challenges) {
    if (completedChallengeIds.has(challenge.id)) continue

    const requiredMissions = (challenge.challenge_missions as { mission_id: string }[]) ?? []
    const allDone = requiredMissions.every(cm => completedMissionIds.has(cm.mission_id))

    if (allDone && requiredMissions.length > 0) {
      // Award bonus points
      const earnEvent = await emitEarnEvent({
        userId,
        eventType: 'mission_completed',
        pointsDelta: challenge.bonus_points,
        contextType: 'challenge',
        contextId: challenge.id,
        notes: `Challenge complete: ${challenge.title}`,
        supabase,
      })

      await supabase.from('challenge_completions').insert({
        user_id:       userId,
        challenge_id:  challenge.id,
        earn_event_id: earnEvent.id,
      })
    }
  }
}

// ─── User summary query ──────────────────────────────────────

export async function getUserClubData(userId: string, supabase: Client) {
  const [ledgerRes, completionsRes, tierRes] = await Promise.all([
    supabase.from('points_ledger').select('*').eq('user_id', userId).single(),
    supabase.from('mission_completions').select('mission_id, completed_at').eq('user_id', userId),
    supabase.from('tier_thresholds').select('*').order('min_lifetime'),
  ])

  return {
    ledger:      ledgerRes.data,
    completions: completionsRes.data ?? [],
    tiers:       tierRes.data ?? [],
  }
}
