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

function normalizePhone(raw: string): string | null {
  const digits = (raw ?? '').replace(/\D/g, '')
  const trimmed = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  return trimmed.length === 10 ? trimmed : null
}

async function linkToastAccount(service: ReturnType<typeof createServiceClient>, profileId: string, email: string | null, phone: string | null) {
  // Find matching Toast account by email first, then phone
  let toastAccount: any = null

  if (email) {
    const { data } = await service
      .from('toast_loyalty_accounts')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle()
    toastAccount = data
  }

  if (!toastAccount && phone) {
    const norm = normalizePhone(phone)
    if (norm) {
      const { data } = await service
        .from('toast_loyalty_accounts')
        .select('*')
        .eq('phone', norm)
        .maybeSingle()
      toastAccount = data
    }
  }

  if (!toastAccount) return null

  // Link profile_id if not already linked
  if (!toastAccount.profile_id) {
    await service
      .from('toast_loyalty_accounts')
      .update({ profile_id: profileId })
      .eq('id', toastAccount.id)
  }

  // Update pos_customer_id on profile
  if (toastAccount.toast_account_id) {
    await service
      .from('profiles')
      .update({ pos_customer_id: toastAccount.toast_account_id })
      .eq('id', profileId)
  }

  // Backfill birthday if profile has none
  if (toastAccount.birthday) {
    const { data: prof } = await service
      .from('profiles')
      .select('birthday')
      .eq('id', profileId)
      .maybeSingle()
    if (prof && !prof.birthday) {
      await service
        .from('profiles')
        .update({ birthday: toastAccount.birthday })
        .eq('id', profileId)
    }
  }

  // Seed points if not already imported
  const appPts = (toastAccount.toast_points ?? 0) * 10
  if (appPts > 0 && !toastAccount.points_imported) {
    const { error: eeErr } = await service.from('earn_events').insert({
      user_id:      profileId,
      event_type:   'purchase_recorded',
      points_delta: appPts,
      context_type: 'toast_import',
      context_id:   toastAccount.id,
      notes:        `Toast loyalty link: ${toastAccount.toast_points} Toast pts → ${appPts} app pts`,
    })
    if (!eeErr) {
      await service
        .from('toast_loyalty_accounts')
        .update({ points_imported: true })
        .eq('id', toastAccount.id)
    }
  }

  return {
    toastPoints:  toastAccount.toast_points ?? 0,
    appPoints:    appPts,
    alreadyHad:   toastAccount.points_imported,
    cardId:       toastAccount.toast_card_id,
  }
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
      await service.from('profiles').upsert({
        id:           authUserId,
        email,
        full_name:    fullName,
        display_name: displayName,
        phone:        phone ?? null,
        role:         'customer',
      }, { onConflict: 'id' })
    } else {
      const { data: newUser, error: authError } = await service.auth.admin.createUser({
        email,
        email_confirm: !sendInvite,
        user_metadata: { full_name: fullName },
      })

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 })
      }

      authUserId = newUser.user.id

      await service.from('profiles').upsert({
        id:           authUserId,
        email,
        full_name:    fullName,
        display_name: displayName,
        phone:        phone ?? null,
        role:         'customer',
        points_total: 0,
      }, { onConflict: 'id' })

      if (sendInvite) {
        await service.auth.admin.inviteUserByEmail(email, {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/auth/callback`,
          data: { full_name: fullName },
        })
      }
    }

    // ── Check for existing Toast loyalty account ───────────────────────────
    const toastInfo = await linkToastAccount(service, authUserId, email, phone ?? null)

    return NextResponse.json({ ok: true, id: authUserId, toastInfo })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
