import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

function normalizePhone(raw: string): string | null {
  const digits = (raw ?? '').replace(/\D/g, '')
  const trimmed = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  return trimmed.length === 10 ? trimmed : null
}

// POST /api/auth/link-toast
// Called after onboarding upsert. Checks if the signed-in user has a matching
// Toast loyalty account, links it, seeds points, and returns the result.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const service = createServiceClient()

  // Fetch the user's profile for email + phone
  const { data: profile } = await service
    .from('profiles')
    .select('id, email, phone, birthday')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) return NextResponse.json({ toastInfo: null })

  const email = profile.email?.toLowerCase().trim() ?? null
  const normPhone = normalizePhone(profile.phone ?? '')

  // Find matching Toast account
  let toastAccount: any = null

  if (email) {
    const { data } = await service
      .from('toast_loyalty_accounts')
      .select('*')
      .eq('email', email)
      .maybeSingle()
    toastAccount = data
  }

  if (!toastAccount && normPhone) {
    const { data } = await service
      .from('toast_loyalty_accounts')
      .select('*')
      .eq('phone', normPhone)
      .maybeSingle()
    toastAccount = data
  }

  if (!toastAccount) return NextResponse.json({ toastInfo: null })

  // Link profile_id
  if (!toastAccount.profile_id) {
    await service
      .from('toast_loyalty_accounts')
      .update({ profile_id: profile.id })
      .eq('id', toastAccount.id)
  }

  // Update pos_customer_id
  if (toastAccount.toast_account_id) {
    await service
      .from('profiles')
      .update({ pos_customer_id: toastAccount.toast_account_id })
      .eq('id', profile.id)
  }

  // Backfill birthday
  if (toastAccount.birthday && !profile.birthday) {
    await service
      .from('profiles')
      .update({ birthday: toastAccount.birthday })
      .eq('id', profile.id)
  }

  // Seed points
  const appPts = (toastAccount.toast_points ?? 0) * 10
  let pointsSeeded = false

  if (appPts > 0 && !toastAccount.points_imported) {
    const { error: eeErr } = await service.from('earn_events').insert({
      user_id:      profile.id,
      event_type:   'purchase_recorded',
      points_delta: appPts,
      context_type: 'toast_import',
      context_id:   toastAccount.id,
      notes:        `Toast loyalty link at sign-up: ${toastAccount.toast_points} Toast pts → ${appPts} app pts`,
    })
    if (!eeErr) {
      await service
        .from('toast_loyalty_accounts')
        .update({ points_imported: true })
        .eq('id', toastAccount.id)
      pointsSeeded = true
    }
  }

  return NextResponse.json({
    toastInfo: {
      toastPoints:  toastAccount.toast_points ?? 0,
      appPoints:    appPts,
      alreadyHad:   toastAccount.points_imported && !pointsSeeded,
      birthdaySaved: !!(toastAccount.birthday && !profile.birthday),
    },
  })
}
