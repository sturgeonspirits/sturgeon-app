// ─────────────────────────────────────────────
// Changelog
//   v2026-08-14.1 — New: claim a roster member into a real signed-up account.
//                   All the merging happens in claim_roster_profile() so it is
//                   one transaction — a partial merge would strand history.
// ─────────────────────────────────────────────
/**
 * POST /api/staff/roster/claim
 * Body: { rosterId: string, targetId: string }
 *
 * Merges a name-only roster member FORWARD into a real account: every row that
 * pointed at the roster profile is repointed at the real one, then the roster
 * row is retired. Forward, not backward, because RLS is written against
 * `auth.uid() = profiles.id` — the surviving row has to be the one whose id
 * matches the auth user.
 *
 * Irreversible. The audit trail lives in public.roster_claims.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/staff-auth'

export async function POST(req: NextRequest) {
  const auth = await requireStaff()
  if (auth instanceof Response) return auth

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { rosterId, targetId } = body ?? {}
  if (!rosterId || typeof rosterId !== 'string') {
    return NextResponse.json({ error: 'rosterId is required' }, { status: 400 })
  }
  if (!targetId || typeof targetId !== 'string') {
    return NextResponse.json({ error: 'targetId is required' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data, error } = await service.rpc('claim_roster_profile' as any, {
    p_roster_id: rosterId,
    p_target_id: targetId,
    p_staff_id:  auth.user.id,
  })

  if (error) {
    // The function raises with a readable message for every rejected case
    // (not a roster member, target missing, claiming into itself).
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, result: data })
}
