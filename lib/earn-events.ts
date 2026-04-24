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

// ─── Toast reconcile ─────────────────────────────────────────

export interface ReconcileToastParams {
  userId: string
  supabase: Client
  /**
   * Notes prefix. If omitted, chosen automatically:
   *   delta > 0 → 'Toast sync'
   *   delta < 0 → 'Toast redemption'
   * Use 'Toast loyalty link' for first-link flows so the audit trail reads naturally.
   */
  notePrefix?: string
}

export interface ReconcileToastResult {
  /** Signed change applied. 0 means no earn_event was emitted. */
  delta: number
  /** Target Toast balance = MAX(toast_points) across the profile's linked active cards. */
  target: number
  /** Sum of prior `toast_import` earn_events for this profile. */
  prior: number
  /** New earn_event id, or null when delta was 0. */
  earnEventId: string | null
}

/**
 * Align a profile's Toast-bucket points to the CURRENT Toast balance.
 *
 * Toast sometimes creates duplicate accounts for one person (gift-card flow)
 * with IDENTICAL balances that move in parallel. We pick MAX(toast_points)
 * across linked active cards as the canonical target — SUM would multi-count.
 *
 * Semantics:
 *   target  = MAX(toast_points) across linked active toast_loyalty_accounts
 *   prior   = SUM(points_delta) of earn_events WHERE context_type = 'toast_import'
 *   delta   = target - prior                 (can be negative; Toast redemptions)
 *
 * If delta is non-zero, emits a single corrective earn_event tagged
 * context_type = 'toast_import' so future reconciles keep working.
 * Leaves App-awarded points (all other context_types) untouched.
 */
export async function reconcileToastToProfile(params: ReconcileToastParams): Promise<ReconcileToastResult> {
  const { userId, supabase, notePrefix } = params

  // 1. Target: MAX(toast_points) across the profile's linked active Toast cards.
  const { data: cards } = await supabase
    .from('toast_loyalty_accounts')
    .select('toast_points')
    .eq('profile_id', userId)
    .eq('is_deactivated', false)

  const target = ((cards ?? []) as { toast_points: number | null }[])
    .reduce((m, c) => Math.max(m, c.toast_points ?? 0), 0)

  // 2. Prior: sum of previous toast_import earn_events for this profile.
  const { data: priorEvents } = await supabase
    .from('earn_events')
    .select('points_delta')
    .eq('user_id', userId)
    .eq('context_type', 'toast_import')

  const prior = ((priorEvents ?? []) as { points_delta: number | null }[])
    .reduce((s, e) => s + (e.points_delta ?? 0), 0)

  const delta = target - prior

  if (delta === 0) {
    return { delta: 0, target, prior, earnEventId: null }
  }

  // 3. Emit corrective event. Keep context_type='toast_import' so the math holds next time.
  const prefix = notePrefix ?? (delta > 0 ? 'Toast sync' : 'Toast redemption')
  const notes  = `${prefix}: ${delta > 0 ? '+' : ''}${delta} pts (Toast balance now ${target}, was ${prior})`

  const evt = await emitEarnEvent({
    userId,
    eventType:   'purchase_recorded',
    pointsDelta: delta,
    contextType: 'toast_import',
    notes,
    supabase,
  })

  return { delta, target, prior, earnEventId: evt.id }
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
