// ─────────────────────────────────────────────
// Changelog
//   v2026-08-14.1 — Refuse point adjustments on roster members (no login, no
//                   balance). Fails with a clear message instead of hitting the
//                   DB trigger.
// ─────────────────────────────────────────────
/**
 * POST /api/staff/customer/adjust-points
 *
 * Staff-only. Manually credit or debit a customer's app points balance.
 * Accepts either a signed `delta` or a `targetBalance` (which gets converted
 * to the equivalent delta server-side using the current ledger).
 *
 * Adjustment is recorded as an `earn_events` row with event_type
 * 'staff_adjustment'. A DB trigger keeps `points_ledger.balance` in sync;
 * we never mutate the balance column directly. Every adjustment leaves an
 * immutable audit trail in `earn_events` with the staff user, delta, and
 * reason.
 *
 * Per-adjustment caps (intentionally asymmetric — credit is the risky
 * direction, debit is the corrective direction):
 *   max credit:  +500
 *   max debit:  -5000
 *
 * Reason is required so the recent-activity feed is legible.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/staff-auth'
import { emitEarnEvent, isRosterMember } from '@/lib/earn-events'

const MAX_CREDIT = 500    // most points a single adjustment can ADD
const MAX_DEBIT  = 5000   // most points a single adjustment can REMOVE (abs value)

export async function POST(req: NextRequest) {
  const auth = await requireStaff()
  if (auth instanceof Response) return auth
  const staffUser = auth.user

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { userId, delta: rawDelta, targetBalance: rawTarget, reason: rawReason } = body ?? {}

  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  if (await isRosterMember(userId, createServiceClient())) {
    return NextResponse.json(
      { error: 'Roster members have no points balance. Link them to a real account first.' },
      { status: 400 },
    )
  }

  const reason = typeof rawReason === 'string' ? rawReason.trim() : ''
  if (!reason) {
    return NextResponse.json({ error: 'A reason is required' }, { status: 400 })
  }
  if (reason.length > 500) {
    return NextResponse.json({ error: 'Reason must be under 500 characters' }, { status: 400 })
  }

  const hasDelta  = rawDelta  !== undefined && rawDelta  !== null && rawDelta  !== ''
  const hasTarget = rawTarget !== undefined && rawTarget !== null && rawTarget !== ''

  if (hasDelta === hasTarget) {
    return NextResponse.json(
      { error: 'Provide either delta or targetBalance — not both, not neither' },
      { status: 400 },
    )
  }

  const service = createServiceClient()

  // Need the current balance both to validate targetBalance mode and to
  // return the resulting balance in the response for optimistic UI update.
  const { data: ledger, error: ledgerErr } = await service
    .from('points_ledger')
    .select('balance')
    .eq('user_id', userId)
    .maybeSingle()
  if (ledgerErr) {
    return NextResponse.json({ error: `Could not read ledger: ${ledgerErr.message}` }, { status: 500 })
  }
  const currentBalance = ledger?.balance ?? 0

  // Resolve delta
  let delta: number
  if (hasDelta) {
    const n = Number(rawDelta)
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      return NextResponse.json({ error: 'delta must be an integer' }, { status: 400 })
    }
    delta = n
  } else {
    const tgt = Number(rawTarget)
    if (!Number.isFinite(tgt) || !Number.isInteger(tgt)) {
      return NextResponse.json({ error: 'targetBalance must be an integer' }, { status: 400 })
    }
    if (tgt < 0) {
      return NextResponse.json({ error: 'targetBalance cannot be negative' }, { status: 400 })
    }
    delta = tgt - currentBalance
  }

  if (delta === 0) {
    return NextResponse.json({ error: 'Adjustment is zero — nothing to do' }, { status: 400 })
  }

  // Enforce caps (asymmetric: credit tighter than debit)
  if (delta > MAX_CREDIT) {
    return NextResponse.json(
      { error: `Single adjustment can credit at most +${MAX_CREDIT} points` },
      { status: 400 },
    )
  }
  if (delta < -MAX_DEBIT) {
    return NextResponse.json(
      { error: `Single adjustment can debit at most ${MAX_DEBIT} points` },
      { status: 400 },
    )
  }

  // Don't let a debit take the balance negative
  const resultingBalance = currentBalance + delta
  if (resultingBalance < 0) {
    return NextResponse.json(
      { error: `Adjustment would take balance to ${resultingBalance}. Current balance is ${currentBalance}.` },
      { status: 400 },
    )
  }

  // Confirm the target user exists (and isn't, say, a staff UUID typo)
  const { data: targetProfile, error: profErr } = await service
    .from('profiles')
    .select('id, display_name')
    .eq('id', userId)
    .maybeSingle()
  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 500 })
  }
  if (!targetProfile) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  // Prepend staff identity to the note so the audit trail survives even if
  // the earn_events table ever gets queried without joining the staff user.
  const staffLabel =
    staffUser?.email ?? staffUser?.user_metadata?.full_name ?? staffUser?.id ?? 'staff'
  const notes = `Staff adjustment by ${staffLabel}: ${reason}`

  try {
    const event = await emitEarnEvent({
      userId,
      eventType:   'staff_adjustment',
      pointsDelta: delta,
      contextType: 'staff_adjustment',
      contextId:   staffUser?.id,
      notes,
      supabase:    service,
    })

    return NextResponse.json({
      ok: true,
      delta,
      newBalance: resultingBalance,
      earnEventId: event.id,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Adjustment failed' }, { status: 500 })
  }
}
