import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/staff-auth'

// Diagnostic endpoint — visit /api/staff/debug while logged in to see session state
export async function GET() {
  const authCheck = await requireStaff()
  if (authCheck instanceof Response) return authCheck

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  let profileData = null
  let profileError = null
  let serviceKeyPresent = !!process.env.SUPABASE_SERVICE_ROLE_KEY

  if (user) {
    try {
      const service = createServiceClient()
      const { data, error } = await service
        .from('profiles')
        .select('id, email, role, full_name')
        .eq('id', user.id)
        .maybeSingle()
      profileData = data
      profileError = error?.message ?? null
    } catch (e: any) {
      profileError = `Service client threw: ${e.message}`
    }
  }

  return NextResponse.json({
    authenticated: !!user,
    userId: user?.id ?? null,
    email: user?.email ?? null,
    appMetadata: (user as any)?.app_metadata ?? null,
    userMetadata: (user as any)?.user_metadata ?? null,
    profileData,
    profileError,
    env: {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceKey: serviceKeyPresent,
    },
    userError: userError?.message ?? null,
  }, { status: 200 })
}
