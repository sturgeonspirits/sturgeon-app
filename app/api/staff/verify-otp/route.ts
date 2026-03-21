import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const { email, token } = await request.json()

  if (!email || !token) {
    return NextResponse.json({ error: 'Missing email or token' }, { status: 400 })
  }

  // Use plain supabase-js client — we just need to verify the token
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })

  if (error || !data.user || !data.session) {
    return NextResponse.json({ error: 'Invalid or expired code.' }, { status: 401 })
  }

  // Check role using service client
  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!profile || !['staff', 'admin'].includes(profile.role ?? '')) {
    return NextResponse.json({ error: 'This account does not have staff access.' }, { status: 403 })
  }

  // Return session tokens — client will call setSession() to store in browser cookies
  return NextResponse.json({
    access_token:  data.session.access_token,
    refresh_token: data.session.refresh_token,
  })
}
