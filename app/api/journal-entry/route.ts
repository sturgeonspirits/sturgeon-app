// ─────────────────────────────────────────────
// Changelog
//   v2026-04-25.1 — Audit P0-3 follow-up: gracefully handle the new
//                   atomic-balance-check trigger when reversing points on
//                   journal delete. Previously a silent clamp masked the
//                   "user already spent these points" case; now the trigger
//                   raises and we have to decide whether to abort the delete.
// ─────────────────────────────────────────────

/**
 * POST /api/journal-entry  — save a tasting log + emit earn events
 * DELETE /api/journal-entry — remove a tasting log owned by the caller
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { emitEarnEvent } from '@/lib/earn-events'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      userId, spiritId, spiritName, spiritCategory,
      nose, palate, finish, overallNotes, rating,
    } = body

    const authClient = await createClient()
    const { data: { user: authUser } } = await authClient.auth.getUser()
    if (!authUser) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    if (authUser.id !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
      pointsDelta: 15,  // base points per entry
      contextType: 'journal_entry',
      contextId:   log.id,
      notes:       'Tasting journal entry',
      supabase,
    })

    // 3. Link earn event back to log
    await supabase.from('tasting_logs').update({ earn_event_id: earnEvent.id }).eq('id', log.id)

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

export async function PATCH(req: NextRequest) {
  try {
    const { logId, spiritName, spiritCategory, nose, palate, finish, overallNotes, rating } = await req.json()
    if (!logId) return NextResponse.json({ error: 'Missing logId' }, { status: 400 })

    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

    const supabase = createServiceClient()

    // Verify ownership
    const { data: existing } = await supabase
      .from('tasting_logs')
      .select('id, user_id')
      .eq('id', logId)
      .maybeSingle()

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { error: updateErr } = await supabase
      .from('tasting_logs')
      .update({
        spirit_name:     spiritName     ?? null,
        spirit_category: spiritCategory ?? null,
        nose:            nose           ?? null,
        palate:          palate         ?? null,
        finish:          finish         ?? null,
        overall_notes:   overallNotes   ?? null,
        rating:          rating         ?? null,
      })
      .eq('id', logId)

    if (updateErr) throw updateErr

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Journal update error:', err)
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { logId } = await req.json()
    if (!logId) return NextResponse.json({ error: 'Missing logId' }, { status: 400 })

    // Verify caller owns the log
    const userClient = await createClient()
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const service = createServiceClient()

    const { data: log } = await service
      .from('tasting_logs')
      .select('id, user_id, earn_event_id')
      .eq('id', logId)
      .maybeSingle()

    if (!log) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (log.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Reverse the earn event FIRST so the points stay consistent. If the
    // user has already spent the points, the atomic-balance-check trigger
    // (migration 20260425000002) will raise SQLSTATE 23514. Catch it and
    // continue with the delete — the journal entry shouldn't be permanently
    // undeletable just because the points were spent.
    let pointsReversed: number | null = null
    let pointsReversalSkipped: 'insufficient_balance' | null = null

    if (log.earn_event_id) {
      const { data: earn } = await service
        .from('earn_events')
        .select('points_delta')
        .eq('id', log.earn_event_id)
        .maybeSingle()

      if (earn) {
        try {
          const reversal = await emitEarnEvent({
            userId:      user.id,
            eventType:   'journal_entry_removed',
            pointsDelta: -Math.abs(earn.points_delta),
            contextType: 'journal_entry',
            contextId:   logId,
            notes:       'Tasting entry removed',
            supabase:    service,
          })
          pointsReversed = reversal.points_delta
        } catch (e: any) {
          // Postgres SQLSTATE 23514 = check_violation, raised by the
          // sync_points_ledger trigger on overdraft. Any other error should
          // still bubble up so we don't silently swallow real bugs.
          const msg = String(e?.message ?? '')
          if (msg.includes('Insufficient points balance')) {
            pointsReversalSkipped = 'insufficient_balance'
            console.warn(
              '[journal/delete] points already spent; deleting log without reversal',
              { userId: user.id, logId, originalDelta: earn.points_delta },
            )
          } else {
            throw e
          }
        }
      }
    }

    // Now delete the log. We do this AFTER the reversal attempt so a real
    // (non-overdraft) DB error rolls back cleanly without orphaning state.
    await service.from('tasting_logs').delete().eq('id', logId)

    return NextResponse.json({
      success: true,
      pointsReversed,
      pointsReversalSkipped,
    })
  } catch (err: any) {
    console.error('Journal delete error:', err)
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 })
  }
}
