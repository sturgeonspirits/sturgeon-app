/**
 * POST /api/journal-entry
 * Save a tasting log and emit earn events for missions.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { emitEarnEvent, completeMission } from '@/lib/earn-events'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      userId, spiritId, spiritName, spiritCategory,
      nose, palate, finish, overallNotes, rating,
    } = body

    if (!userId) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const supabase = createServiceClient()

    // 1. Insert tasting log
    const { data: log, error } = await supabase
      .from('tasting_logs')
      .insert({
        user_id:         userId,
        spirit_id:       spiritId  ?? null,
        spirit_name:     spiritName ?? null,
        spirit_category: spiritCategory ?? null,
        nose:            nose    ?? null,
        palate:          palate  ?? null,
        finish:          finish  ?? null,
        overall_notes:   overallNotes ?? null,
        rating:          rating  ?? null,
        visited_at:      new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    // 2. Emit base earn event for the journal entry
    const earnEvent = await emitEarnEvent({
      userId,
      eventType:   'journal_entry',
      pointsDelta: 25,  // base points per entry
      contextType: 'journal_entry',
      contextId:   log.id,
      notes:       'Tasting journal entry',
      supabase,
    })

    // 3. Link earn event back to log
    await supabase.from('tasting_logs').update({ earn_event_id: earnEvent.id }).eq('id', log.id)

    // 4. Trigger mission completions (best-effort — missing slugs won't fail the entry)
    try {
      await completeMission({ userId, missionSlug: 'taste-a-spirit', supabase })
    } catch { /* mission not seeded yet */ }

    try {
      const { count } = await supabase
        .from('tasting_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
      if ((count ?? 0) >= 3) {
        await completeMission({ userId, missionSlug: 'taste-three-spirits', supabase })
      }
    } catch { /* mission not seeded yet */ }

    return NextResponse.json({
      success: true,
      logId: log.id,
      pointsEarned: earnEvent.points_delta,
    })
  } catch (err: any) {
    console.error('Journal entry error:', err)
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 })
  }
}
