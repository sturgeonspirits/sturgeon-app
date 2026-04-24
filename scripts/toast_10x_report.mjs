#!/usr/bin/env node
/**
 * Report on Toast loyalty imports that used the 10x multiplier.
 *
 * The import path in app/api/staff/customer/route.ts does:
 *   appPoints = toast_points * 10
 * and inserts an earn_event with:
 *   event_type   = 'purchase_recorded'
 *   context_type = 'toast_import'
 *   context_id   = toast_loyalty_accounts.id
 *
 * This script:
 *   1. Finds every toast_import earn_event
 *   2. Groups by user to count distinct affected accounts
 *   3. Totals the inflated app points that came from this path
 *   4. Shows a small sample so we can eyeball the damage
 *
 * Reads env from .env.local in the sturgeon-app directory.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

// ── Load .env.local ─────────────────────────────────────────
const envPath = path.resolve(process.argv[2] ?? '/sessions/happy-awesome-ride/mnt/sturgeon-app/.env.local')
const envText = fs.readFileSync(envPath, 'utf8')
const env = {}
for (const line of envText.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
  if (!m) continue
  let val = m[2]
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1)
  }
  env[m[1]] = val
}

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

// ── Pull all toast_import earn events ───────────────────────
// Could be several thousand — page through to be safe.
const PAGE = 1000
let all = []
for (let from = 0; ; from += PAGE) {
  const { data, error } = await sb
    .from('earn_events')
    .select('id, user_id, points_delta, notes, created_at, context_id')
    .eq('context_type', 'toast_import')
    .order('created_at', { ascending: false })
    .range(from, from + PAGE - 1)

  if (error) {
    console.error('Query error:', error.message)
    process.exit(1)
  }
  if (!data || data.length === 0) break
  all = all.concat(data)
  if (data.length < PAGE) break
}

if (all.length === 0) {
  console.log('No toast_import earn_events found.')
  process.exit(0)
}

// ── Aggregate ──────────────────────────────────────────────
const byUser = new Map()  // user_id -> { imports: [], totalDelta }
for (const e of all) {
  if (!byUser.has(e.user_id)) byUser.set(e.user_id, { imports: [], totalDelta: 0 })
  const row = byUser.get(e.user_id)
  row.imports.push(e)
  row.totalDelta += e.points_delta ?? 0
}

// Extract "X Toast pts → Y app pts" from notes so we can confirm the 10x ratio.
const RATIO_RE = /Toast loyalty link:\s*(\d+)\s*Toast pts\s*→\s*(\d+)\s*app pts/i
let tenXCount = 0        // events whose notes show an exact 10x relationship
let nonTenXCount = 0     // events with a parseable but different ratio (shouldn't happen)
let unparseableCount = 0 // events whose notes don't match the expected pattern
const ratios = new Map() // ratio string -> count, e.g. "10" -> 147

for (const e of all) {
  const m = (e.notes ?? '').match(RATIO_RE)
  if (!m) { unparseableCount++; continue }
  const toastPts = Number(m[1])
  const appPts   = Number(m[2])
  if (toastPts === 0) {
    // degenerate; skip ratio calc
    ratios.set('0→0', (ratios.get('0→0') ?? 0) + 1)
    continue
  }
  const ratio = Math.round((appPts / toastPts) * 100) / 100
  const key = String(ratio)
  ratios.set(key, (ratios.get(key) ?? 0) + 1)
  if (ratio === 10) tenXCount++
  else nonTenXCount++
}

// Resolve display names for the top 10 affected accounts
const topUsers = [...byUser.entries()]
  .sort((a, b) => b[1].totalDelta - a[1].totalDelta)
  .slice(0, 10)

const topIds = topUsers.map(([id]) => id)
const { data: profiles } = await sb
  .from('profiles')
  .select('id, display_name, full_name, email')
  .in('id', topIds)

const profById = new Map((profiles ?? []).map(p => [p.id, p]))

// Also look up current ledger balance for each of the top users
const { data: ledgers } = await sb
  .from('points_ledger')
  .select('user_id, balance')
  .in('user_id', topIds)

const balById = new Map((ledgers ?? []).map(l => [l.user_id, l.balance]))

// ── Print report ───────────────────────────────────────────
const fmt = n => (n ?? 0).toLocaleString()
console.log('\n══════════  TOAST 10x IMPORT REPORT  ══════════')
console.log(`\ntoast_import earn_events total:       ${fmt(all.length)}`)
console.log(`  notes showing exact 10x ratio:      ${fmt(tenXCount)}`)
console.log(`  notes showing a different ratio:    ${fmt(nonTenXCount)}`)
console.log(`  notes unparseable (no Toast→app):   ${fmt(unparseableCount)}`)

console.log(`\nDistinct profiles affected:           ${fmt(byUser.size)}`)

let grandTotalDelta = 0
for (const row of byUser.values()) grandTotalDelta += row.totalDelta
console.log(`Total app points granted via import:  ${fmt(grandTotalDelta)}`)
console.log(`Implied inflation at 10x (would-be-reduction to 1x): ${fmt(Math.round(grandTotalDelta * 0.9))}`)

console.log('\nRatio distribution (Toast pts → app pts):')
for (const [ratio, count] of [...ratios.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${ratio.padEnd(6)}  ${fmt(count)}`)
}

console.log('\nTop 10 accounts by imported app-point total:')
console.log('  name / email                                         imports   granted   current-bal')
console.log('  ─────────────────────────────────────────────────── ─────── ──────────  ───────────')
for (const [uid, row] of topUsers) {
  const p = profById.get(uid)
  const label = (p?.display_name ?? p?.full_name ?? p?.email ?? uid).slice(0, 50).padEnd(51)
  const imports = String(row.imports.length).padStart(7)
  const granted = fmt(row.totalDelta).padStart(10)
  const balance = fmt(balById.get(uid) ?? 0).padStart(11)
  console.log(`  ${label} ${imports} ${granted}  ${balance}`)
}

console.log('\nOldest and newest toast_import timestamps:')
const sorted = [...all].sort((a, b) => a.created_at.localeCompare(b.created_at))
console.log(`  first: ${sorted[0].created_at}`)
console.log(`  last:  ${sorted[sorted.length - 1].created_at}`)
console.log('\n═══════════════════════════════════════════════\n')
