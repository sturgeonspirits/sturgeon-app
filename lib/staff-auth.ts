/**
 * Shared staff auth helper for API routes.
 *
 * Usage:
 *   const auth = await requireStaff()
 *   if (auth instanceof Response) return auth   // 401 or 403
 *   // auth.user is now available
 */
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const STAFF_ROLES = ['staff', 'admin']

export async function requireStaff(): Promise<{ user: any } | NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  // Fast path: app_metadata role (set by admin SQL, no DB query needed)
  const appRole: string = (user as any).app_metadata?.role ?? ''
  if (STAFF_ROLES.includes(appRole)) return { user }

  // Fallback: check profiles table
  const service = createServiceClient()
  const { data } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!STAFF_ROLES.includes(data?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return { user }
}
