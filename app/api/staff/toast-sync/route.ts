import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ── Auth guard ────────────────────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizePhone(raw: string): string | null {
  const digits = (raw ?? '').replace(/\D/g, '')
  const trimmed = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  return trimmed.length === 10 ? trimmed : null
}

function parseToastDate(s: string): string | null {
  if (!s) return null
  // Toast export format: "7/30/2025 8:02 PM"
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)$/i)
  if (!m) return null
  let [, mo, dy, yr, hr, mn, ampm] = m
  let h = parseInt(hr)
  if (ampm.toUpperCase() === 'PM' && h !== 12) h += 12
  if (ampm.toUpperCase() === 'AM' && h === 12) h = 0
  return new Date(
    parseInt(yr), parseInt(mo) - 1, parseInt(dy), h, parseInt(mn)
  ).toISOString()
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/)
  if (lines.length < 2) return []
  // Parse header, handling quoted fields
  const parseRow = (line: string): string[] => {
    const result: string[] = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
        else inQ = !inQ
      } else if (c === ',' && !inQ) {
        result.push(cur)
        cur = ''
      } else {
        cur += c
      }
    }
    result.push(cur)
    return result
  }

  // Strip BOM if present
  const rawHeader = lines[0].replace(/^\uFEFF/, '')
  const headers = parseRow(rawHeader)
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const vals = parseRow(line)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h.trim()] = (vals[idx] ?? '').trim() })
    rows.push(row)
  }
  return rows
}

// ── POST /api/staff/toast-sync ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    await assertStaff()
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 })
  }

  const service = createServiceClient()

  // Parse multipart form data
  let csvText: string
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    csvText = await file.text()
  } catch {
    return NextResponse.json({ error: 'Failed to read uploaded file' }, { status: 400 })
  }

  const rows = parseCSV(csvText)
  if (!rows.length) return NextResponse.json({ error: 'CSV appears empty' }, { status: 400 })

  const active = rows.filter(r => (r['De-activated?'] ?? '').toLowerCase() !== 'true')

  // ── Fetch app profiles for matching ────────────────────────────────────────
  const { data: profilesRaw, error: pErr } = await service
    .from('profiles')
    .select('id, email, phone, pos_customer_id, birthday')
    .limit(20000)

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  const emailToProfile: Record<string, any> = {}
  const phoneToProfile: Record<string, any> = {}
  for (const p of profilesRaw ?? []) {
    if (p.email) emailToProfile[p.email.toLowerCase().trim()] = p
    const norm = normalizePhone(p.phone ?? '')
    if (norm) phoneToProfile[norm] = p
  }

  // ── Build upsert records ───────────────────────────────────────────────────
  const counters = {
    total: rows.length,
    active: active.length,
    skippedDeactivated: rows.length - active.length,
    upserted: 0,
    matchedEmail: 0,
    matchedPhone: 0,
    unmatched: 0,
    pointsImported: 0,
    birthdaysSaved: 0,
    errors: 0,
  }

  const toUpsert: any[] = []

  for (const r of active) {
    const toastPts = parseInt(r['Total Points'] || '0') || 0
    const email    = r['Email']?.toLowerCase().trim() || null
    const phone    = normalizePhone(r['Phone number'] ?? '')
    const birthday = r['Birthday (MM/DD)']?.trim() || null

    let profile: any = null
    let matchMethod: string | null = null
    if (email) {
      profile = emailToProfile[email]
      if (profile) matchMethod = 'email'
    }
    if (!profile && phone) {
      profile = phoneToProfile[phone]
      if (profile) matchMethod = 'phone'
    }

    if (matchMethod === 'email') counters.matchedEmail++
    else if (matchMethod === 'phone') counters.matchedPhone++
    else counters.unmatched++

    toUpsert.push({
      toast_card_id:    r['Card ID'],
      toast_account_id: r['Account ID'],
      card_number:      r['Card Number']?.trim() || null,
      is_classic_card:  (r['Classic Card?'] ?? '').toLowerCase() === 'true',
      is_deactivated:   false,
      email,
      phone,
      toast_points:     toastPts,
      accrue_count:     parseInt(r['# Accrue Trans.'] || '0') || 0,
      redeem_count:     parseInt(r['# Redeem Trans.'] || '0') || 0,
      first_trans_at:   parseToastDate(r['First Trans. Date'] ?? ''),
      last_trans_at:    parseToastDate(r['Last Trans. Date'] ?? ''),
      birthday,
      profile_id:       profile?.id ?? null,
      points_imported:  false,
    })
  }

  // ── Batch upsert (200 at a time) ───────────────────────────────────────────
  const BATCH = 200
  for (let i = 0; i < toUpsert.length; i += BATCH) {
    const batch = toUpsert.slice(i, i + BATCH)
    const { error } = await service
      .from('toast_loyalty_accounts')
      .upsert(batch, { onConflict: 'toast_card_id', ignoreDuplicates: false })
    if (error) {
      return NextResponse.json({ error: `Upsert failed: ${error.message}` }, { status: 500 })
    }
    counters.upserted += batch.length
  }

  // ── Seed points for newly-matched accounts ─────────────────────────────────
  const { data: pendingAccounts } = await service
    .from('toast_loyalty_accounts')
    .select('id, toast_account_id, profile_id, toast_points, birthday, points_imported')
    .not('profile_id', 'is', null)
    .eq('points_imported', false)
    .limit(10000)

  for (const acct of pendingAccounts ?? []) {
    const profileId = acct.profile_id
    const appPts    = (acct.toast_points ?? 0) * 10

    // Create earn_event
    if (appPts > 0) {
      const { error: eeErr } = await service.from('earn_events').insert({
        user_id:      profileId,
        event_type:   'purchase_recorded',
        points_delta: appPts,
        context_type: 'toast_import',
        context_id:   acct.id,
        notes:        `Toast loyalty import: ${acct.toast_points} Toast pts → ${appPts} app pts`,
      })
      if (!eeErr) counters.pointsImported++
      else counters.errors++
    }

    // Update pos_customer_id
    await service
      .from('profiles')
      .update({ pos_customer_id: acct.toast_account_id })
      .eq('id', profileId)

    // Backfill birthday if profile has none
    if (acct.birthday) {
      const profile = (profilesRaw ?? []).find(p => p.id === profileId)
      if (profile && !profile.birthday) {
        await service
          .from('profiles')
          .update({ birthday: acct.birthday })
          .eq('id', profileId)
        counters.birthdaysSaved++
      }
    }

    // Mark imported
    await service
      .from('toast_loyalty_accounts')
      .update({ points_imported: true })
      .eq('id', acct.id)
  }

  return NextResponse.json({ ok: true, counters })
}
