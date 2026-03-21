import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  const { email, token } = await request.json()

  if (!email || !token) {
    return NextResponse.json({ error: 'Missing email or token' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })

  if (error || !data.user) {
    return NextResponse.json({ error: 'Invalid or expired code.' }, { status: 401 })
  }

  // Check role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!profile || !['staff', 'admin'].includes(profile.role ?? '')) {
    await supabase.auth.signOut()
    return NextResponse.json({ error: 'This account does not have staff access.' }, { status: 403 })
  }

  return NextResponse.json({ success: true })
}
