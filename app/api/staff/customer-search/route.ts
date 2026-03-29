/**
 * GET /api/staff/customer-search?q=...
 * Staff-only: fuzzy search members by name or email.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    // Auth + role check
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const appRole: string = (user as any).app_metadata?.role ?? ''
    if (!['staff', 'admin'].includes(appRole)) {
      // Fall back to profiles table check
      const service = createServiceClient()
      const { data: p } = await service.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (!['staff', 'admin'].includes(p?.role ?? '')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
    if (!q) return NextResponse.json({ customers: [] })

    const service = createServiceClient()
    const { data, error } = await service
      .from('profiles')
      .select('id, display_name, email')
      .or(`display_name.ilike.%${q}%,email.ilike.%${q}%,full_name.ilike.%${q}%`)
      .order('display_name')
      .limit(8)

    if (error) {
      console.error('customer-search error:', error)
      return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }

    return NextResponse.json({ customers: data ?? [] })
  } catch (err: any) {
    console.error('customer-search error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
