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

export async function POST(req: NextRequest) {
  try {
    await assertStaff()
    const service = createServiceClient()
    const { fullName, email, phone, sendInvite } = await req.json()

    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    if (!fullName) return NextResponse.json({ error: 'Full name is required' }, { status: 400 })

    // Build display name: "Karl B." style
    const parts = fullName.trim().split(/\s+/)
    const displayName = parts.length > 1
      ? `${parts[0]} ${parts[parts.length - 1][0]}.`
      : parts[0]

    // Check if auth user already exists
    const { data: existingUsers } = await service.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email)

    let authUserId: string

    if (existingUser) {
      authUserId = existingUser.id
      // Update their profile if it exists
      await service.from('profiles').upsert({
        id:           authUserId,
        email,
        full_name:    fullName,
        display_name: displayName,
        phone:        phone ?? null,
        role:         'customer',
      }, { onConflict: 'id' })
    } else {
      // Create new auth user
      const { data: newUser, error: authError } = await service.auth.admin.createUser({
        email,
        email_confirm:    !sendInvite, // if sending invite, don't auto-confirm
        user_metadata:    { full_name: fullName },
      })

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 })
      }

      authUserId = newUser.user.id

      // Create profile
      await service.from('profiles').upsert({
        id:           authUserId,
        email,
        full_name:    fullName,
        display_name: displayName,
        phone:        phone ?? null,
        role:         'customer',
        points_total: 0,
      }, { onConflict: 'id' })

      // Send invite email if requested (Supabase sends a magic-link sign-in email)
      if (sendInvite) {
        await service.auth.admin.inviteUserByEmail(email, {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/auth/callback`,
          data: { full_name: fullName },
        })
      }
    }

    return NextResponse.json({ ok: true, id: authUserId })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
