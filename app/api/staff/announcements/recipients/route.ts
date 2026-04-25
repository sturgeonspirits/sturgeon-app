// ─────────────────────────────────────────────
// Changelog
//   v2026-04-25.1 — Initial route. Returns recipient count for the confirm step.
// ─────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function assertStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')
  const role: string = (user as any).app_metadata?.role ?? ''
  if (['staff', 'admin'].includes(role)) return user
  const service = createServiceClient()
  const { data } = await service.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!['staff', 'admin'].includes(data?.role ?? '')) throw new Error('Forbidden')
  return user
}

// GET /api/staff/announcements/recipients?target=all
// Returns { count: number } — subscriber count for the chosen target.
// The form uses this in the confirm step ("You're about to send to N people").
export async function GET(req: NextRequest) {
  try {
    await assertStaff()
  } catch (e: any) {
    const code = e.message === 'Unauthenticated' ? 401 : 403
    return NextResponse.json({ error: e.message }, { status: code })
  }

  const target = req.nextUrl.searchParams.get('target') ?? 'all'
  if (target !== 'all') {
    return NextResponse.json({ error: 'Unsupported target type' }, { status: 400 })
  }

  const service = createServiceClient()
  const { count, error } = await service
    .from('push_subscriptions')
    .select('*', { count: 'exact', head: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ count: count ?? 0 })
}
