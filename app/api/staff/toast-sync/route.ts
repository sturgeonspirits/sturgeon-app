// ─────────────────────────────────────────────
// Changelog
//   v2026-07-13.1 — Support new Toast RewardsCards export format that dropped the
//                   Card ID / Account ID columns: fall back to Card Number as the
//                   identifier, mapping to existing rows via card_number so no
//                   duplicates are created. Dedupe upsert batch by toast_card_id.
//   v2026-05-17.1 — Skip CSV rows missing Card ID; add skippedNoCardId counter (fixes NOT NULL upsert error on toast_card_id)
// ─────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { reconcileToastToProfile } from '@/lib/earn-events'

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
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 413 })
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
    skippedNoCardId: 0,        // rows dropped because Card ID was blank/missing
    upserted: 0,
    matchedEmail: 0,
    matchedPhone: 0,
    unmatched: 0,
    profilesReconciled: 0,     // profiles that had a non-zero reconcile delta applied
    profilesUnchanged: 0,      // profiles where Toast bucket already matched
    pointsAdded: 0,            // total points added across profiles (positive deltas)
    pointsRemoved: 0,          // total points removed across profiles (abs of negatives)
    redemptions: 0,            // count of profiles with negative deltas (Toast-side redemptions)
    birthdaysSaved: 0,
    errors: 0,
  }

  const toUpsert: any[] = []
  const skippedNoCardIdRows: number[] = []  // 1-indexed CSV row numbers for logging

  // ── Card Number → existing identifiers fallback ────────────────────────────
  // Mid-2026, Toast dropped the "Card ID" / "Account ID" columns from the
  // RewardsCards export, leaving "Card Number" as the only identifier. For rows
  // without explicit IDs we fall back to Card Number — but first map it to the
  // toast_card_id / toast_account_id already stored from earlier imports, so
  // re-importing under the new format updates existing rows instead of
  // creating duplicates keyed by card number.
  const needsFallback = active.some(r =>
    (!(r['Card ID'] ?? '').trim() || !(r['Account ID'] ?? '').trim()) &&
    (r['Card Number'] ?? '').trim()
  )
  const existingByCardNumber: Record<string, { toast_card_id: string; toast_account_id: string }> = {}
  if (needsFallback) {
    const { data: existing, error: eErr } = await service
      .from('toast_loyalty_accounts')
      .select('toast_card_id, toast_account_id, card_number')
      .not('card_number', 'is', null)
      .limit(20000)
    if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 })
    for (const a of existing ?? []) {
      if (a.card_number) existingByCardNumber[a.card_number.trim()] = a
    }
  }

  for (let idx = 0; idx < active.length; idx++) {
    const r = active[idx]

    // Guard: toast_card_id and toast_account_id are NOT NULL UNIQUE in the DB.
    // Toast occasionally exports voided/promo rows with blank IDs — skipping them
    // here prevents one bad row from killing the whole batch.
    const cardNumber = (r['Card Number'] ?? '').trim()
    const existing   = cardNumber ? existingByCardNumber[cardNumber] : undefined
    const cardId     = (r['Card ID'] ?? '').trim() || existing?.toast_card_id || cardNumber
    const accountId  = (r['Account ID'] ?? '').trim() || existing?.toast_account_id || cardId
    if (!cardId || !accountId) {
      counters.skippedNoCardId++
      // +2 because: header line = row 1, and idx is 0-based within `active`.
      // (Approximate — deactivated rows were filtered out — but useful for support.)
      skippedNoCardIdRows.push(idx + 2)
      continue
    }

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
      toast_card_id:    cardId,
      toast_account_id: accountId,
      card_number:      cardNumber || null,
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
      // points_imported intentionally omitted — never reset it on upsert
    })
  }

  // ── Batch upsert (200 at a time) ───────────────────────────────────────────
  // NOTE: points_imported is intentionally NOT included in the upsert payload.
  // Including it would reset the flag to false on every CSV upload, causing
  // all accounts to re-import points on the next sync. Let the DB keep its
  // existing value (true/false); we use delta logic below to decide what to import.
  // Dedupe by toast_card_id (last row wins) — Postgres rejects an upsert batch
  // that touches the same conflict key twice ("cannot affect row a second time").
  const dedupedMap = new Map<string, any>()
  for (const rec of toUpsert) dedupedMap.set(rec.toast_card_id, rec)
  const deduped = [...dedupedMap.values()]

  const BATCH = 200
  for (let i = 0; i < deduped.length; i += BATCH) {
    const batch = deduped.slice(i, i + BATCH)
    const { error } = await service
      .from('toast_loyalty_accounts')
      .upsert(batch, { onConflict: 'toast_card_id', ignoreDuplicates: false })
    if (error) {
      return NextResponse.json({ error: `Upsert failed: ${error.message}` }, { status: 500 })
    }
    counters.upserted += batch.length
  }

  // ── Per-profile reconcile (not per-card!) ──────────────────────────────────
  // Toast creates duplicate accounts for gift-card users; balances move in parallel.
  // We reconcile at the profile level using reconcileToastToProfile, which picks
  // MAX(toast_points) across a profile's linked cards. Negative deltas (Toast-side
  // redemptions) flow through so balances go DOWN as well as UP.
  const { data: linkedCards } = await service
    .from('toast_loyalty_accounts')
    .select('id, profile_id, toast_account_id, toast_points, birthday, last_trans_at')
    .not('profile_id', 'is', null)
    .eq('is_deactivated', false)
    .limit(20000)

  // Group cards by profile, pick a canonical one for birthday / pos_customer_id metadata.
  const cardsByProfile = new Map<string, any[]>()
  for (const c of linkedCards ?? []) {
    if (!c.profile_id) continue
    const list = cardsByProfile.get(c.profile_id) ?? []
    list.push(c)
    cardsByProfile.set(c.profile_id, list)
  }

  for (const [profileId, cards] of cardsByProfile) {
    // Canonical card: highest toast_points, tie-break by most recent transaction.
    const canonical = [...cards].sort((a, b) =>
      (b.toast_points ?? 0) - (a.toast_points ?? 0) ||
      (new Date(b.last_trans_at ?? 0).getTime() - new Date(a.last_trans_at ?? 0).getTime())
    )[0]

    // Reconcile Toast-bucket points via the shared helper.
    try {
      const result = await reconcileToastToProfile({ userId: profileId, supabase: service })
      if (result.delta > 0) {
        counters.profilesReconciled++
        counters.pointsAdded += result.delta
      } else if (result.delta < 0) {
        counters.profilesReconciled++
        counters.redemptions++
        counters.pointsRemoved += -result.delta
      } else {
        counters.profilesUnchanged++
      }
    } catch (e: any) {
      console.error('[toast-sync] reconcile failed for profile', profileId, e?.message)
      counters.errors++
      continue
    }

    // Update pos_customer_id on the profile (any linked card's id works; pick canonical).
    if (canonical?.toast_account_id) {
      await service
        .from('profiles')
        .update({ pos_customer_id: canonical.toast_account_id })
        .eq('id', profileId)
    }

    // Backfill birthday if profile has none and any card has one.
    const cardWithBirthday = cards.find(c => c.birthday)
    if (cardWithBirthday?.birthday) {
      const profile = (profilesRaw ?? []).find((p: any) => p.id === profileId)
      if (profile && !profile.birthday) {
        await service
          .from('profiles')
          .update({ birthday: cardWithBirthday.birthday })
          .eq('id', profileId)
        counters.birthdaysSaved++
      }
    }
  }

  // Include the first 20 skipped row numbers in the response so the operator
  // can spot-check the CSV without us having to dump the whole list.
  const responseBody: any = { ok: true, counters }
  if (skippedNoCardIdRows.length > 0) {
    responseBody.skippedNoCardIdSample = skippedNoCardIdRows.slice(0, 20)
    console.warn(
      `[toast-sync] Skipped ${skippedNoCardIdRows.length} row(s) with missing Card ID / Account ID. ` +
      `First 20: ${skippedNoCardIdRows.slice(0, 20).join(', ')}`
    )
  }
  return NextResponse.json(responseBody)
}
