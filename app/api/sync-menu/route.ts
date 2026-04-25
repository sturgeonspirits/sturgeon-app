// ─────────────────────────────────────────────
// Changelog
//   v2026-04-25.1 — Also sync the Hours tab into distillery_hours.
//                   Wrapped in its own try/catch so a hours parse failure
//                   doesn't fail the menu sync (or vice versa).
// ─────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parseDayOfWeek, parseHoursCell, type HoursRow } from '@/lib/hours'

// Google Sheet ID
const SHEET_ID = '1TO0jjaBG32-sEYNJ06zQdkO5Av9YOCg1_RLVumlgwEc'

// Tab URLs — use sheet name so we never need to chase GIDs
const RECIPES_URL    = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`
const CATEGORIES_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Categories`
const HOURS_URL      = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Hours`

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

function parseBool(val: string): boolean {
  return val?.toUpperCase() === 'TRUE'
}

function parsePrice(val: string): number | null {
  const n = parseFloat(val?.replace('$', '') ?? '')
  return isNaN(n) ? null : n
}

function parseTags(val: string): string[] {
  return val ? val.split(',').map(t => t.trim()).filter(Boolean) : []
}

function parseIngredients(cols: string[]): string[] {
  return cols.filter(Boolean)
}

/**
 * Fetch + parse the Hours tab into structured rows.
 *
 * Sheet shape:
 *   Location | Date | Day | Hours
 *   Tasting Room |       | Monday    | Closed
 *   Tasting Room |       | Tuesday   | 4 PM - 8 PM
 *   Tasting Room | 2026-12-25 | Friday | Closed     ← override row
 *
 * Returns one HoursRow per parseable row. Rows that can't be parsed are
 * recorded with raw_hours_text so staff can spot the bad cell on the audit
 * trail without losing the rest of the sync.
 */
async function fetchHoursRows(): Promise<HoursRow[]> {
  const out: HoursRow[] = []
  try {
    const res = await fetch(HOURS_URL, { cache: 'no-store' })
    if (!res.ok) return out

    const csv = await res.text()
    const lines = csv.split('\n').filter(l => l.trim())
    if (lines.length < 2) return out

    // Header row: Location, Date, Day, Hours
    // We index by header-name lookup so the sheet can reorder columns without breaking parse.
    const headers = parseCSVLine(lines[0]).map(h => h.replace(/^﻿/, '').toLowerCase().trim())
    const idx = {
      location: headers.findIndex(h => h === 'location'),
      date:     headers.findIndex(h => h === 'date'),
      day:      headers.findIndex(h => h === 'day'),
      hours:    headers.findIndex(h => h === 'hours'),
    }
    if (idx.location < 0 || idx.day < 0 || idx.hours < 0) {
      console.warn('[sync-menu/hours] missing required columns in Hours tab; got', headers)
      return out
    }

    let primaryClaimed: Set<string> = new Set()
    let sortCounter = 0

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i])
      const location = cols[idx.location]?.trim()
      if (!location) continue   // skip blank rows

      const dateRaw = idx.date >= 0 ? cols[idx.date]?.trim() : ''
      const dayRaw  = cols[idx.day]?.trim() ?? ''
      const hoursRaw = cols[idx.hours]?.trim() ?? ''

      const override_date = dateRaw ? normalizeDate(dateRaw) : null
      const day_of_week   = override_date ? null : parseDayOfWeek(dayRaw)

      // Skip rows that aren't usable: no override AND no recognizable day
      if (!override_date && day_of_week === null) {
        console.warn('[sync-menu/hours] skipping row with no date or day:', cols)
        continue
      }

      const parsed = parseHoursCell(hoursRaw)

      // First weekly row per location is marked primary unless someone else claimed it.
      const is_primary = !primaryClaimed.has(location) && !override_date
      if (is_primary) primaryClaimed.add(location)

      out.push({
        location,
        day_of_week,
        override_date,
        is_closed:       parsed.is_closed,
        open_time:       parsed.open_time,
        close_time:      parsed.close_time,
        closes_next_day: parsed.closes_next_day,
        note:            null,
        is_primary,
        sort_order:      sortCounter++,
        raw_hours_text:  hoursRaw || null,
      })
    }
  } catch (e) {
    console.warn('[sync-menu/hours] fetch failed:', (e as Error).message)
  }
  return out
}

/** Best-effort date normalization → YYYY-MM-DD. Accepts "12/25/2026", "2026-12-25", "Dec 25 2026". */
function normalizeDate(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null

  // YYYY-MM-DD already
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return s

  // M/D/YYYY or MM/DD/YYYY
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (us) {
    const [, mo, dy, yr] = us
    return `${yr}-${mo.padStart(2, '0')}-${dy.padStart(2, '0')}`
  }

  // Fallback: let JS try
  const d = new Date(s)
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10)
  }
  return null
}

/** Fetch the Categories tab and return a map of section name → sort order */
async function fetchSectionOrder(): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  try {
    const res = await fetch(CATEGORIES_URL, { cache: 'no-store' })
    if (!res.ok) return map
    const csv   = await res.text()
    const lines = csv.split('\n').filter(l => l.trim())
    for (let i = 1; i < lines.length; i++) {
      const cols    = parseCSVLine(lines[i])
      const name    = cols[0]?.trim()
      const sortNum = parseInt(cols[1]) || 999
      if (name) map.set(name, sortNum)
    }
  } catch {
    // Non-fatal: fall back to 999 for all sections if tab unreachable
  }
  return map
}

export async function POST(request: Request) {
  // Verify caller is authorized. Two accepted credentials:
  //   - x-sync-secret: SYNC_SECRET  — used by the staff "Sync Menu" button
  //   - x-cron-secret: CRON_SECRET  — used by the Netlify scheduled function
  const syncHeader = request.headers.get('x-sync-secret')
  const cronHeader = request.headers.get('x-cron-secret')
  const syncSecret = process.env.SYNC_SECRET
  const cronSecret = process.env.CRON_SECRET

  const syncOk = Boolean(syncSecret) && syncHeader === syncSecret
  const cronOk = Boolean(cronSecret) && cronHeader === cronSecret

  if (!syncOk && !cronOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Fetch both tabs in parallel
    const [recipesRes, sectionOrder] = await Promise.all([
      fetch(RECIPES_URL, { cache: 'no-store' }),
      fetchSectionOrder(),
    ])

    if (!recipesRes.ok) throw new Error(`Google Sheets fetch failed: ${recipesRes.status}`)

    const csv   = await recipesRes.text()
    const lines = csv.split('\n').filter(l => l.trim())

    // Parse all rows
    const recipes: Record<string, any>[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i])
      if (!cols[0]) continue // skip empty rows

      // Columns from sheet:
      // 0:name 1:show_on_menu 2:price 3:menu_section 4:tags 5:flavor_tags
      // 6:sort_order 7:menu_ingredients
      // 8-17: ingredient1-10 18:instructions 19:photo_url 20:glassware
      // 21:(blank) 22:author 23:date 24:(blank) 25:notes 26:event_menu 27:grocery_override
      const name = cols[0]
      if (!name || name === 'Recipe Name') continue

      const menuSection = cols[3]?.trim() || null

      const ingredients = parseIngredients([
        cols[8],  cols[9],  cols[10], cols[11], cols[12],
        cols[13], cols[14], cols[15], cols[16], cols[17],
      ])

      recipes.push({
        name,
        show_on_menu:      parseBool(cols[1]),
        price:             parsePrice(cols[2]),
        menu_section:      menuSection,
        tags:              parseTags(cols[4]),
        flavor_tags:       parseTags(cols[5]),
        sort_order:        parseInt(cols[6]) || 999,
        section_sort_order: menuSection ? (sectionOrder.get(menuSection) ?? 999) : 999,
        menu_ingredients:  cols[7] || null,
        ingredients,
        instructions:      cols[18] || null,
        photo_url:         cols[19] || null,
        glassware:         cols[20] || null,
        author:            cols[22] || null,
        recipe_date:       cols[23] || null,
        notes:             cols[25] || null,
        is_event_menu:     parseBool(cols[26]),
        grocery_override:  cols[27] || null,
        is_active:         true,
      })
    }

    // Deduplicate by name — last row wins (matches sheet order)
    const seen = new Map<string, Record<string, any>>()
    for (const r of recipes) seen.set(r.name, r)
    const deduped = Array.from(seen.values())

    // Upsert into Supabase (match on name)
    const supabase = createServiceClient()

    // Soft-delete all existing, then upsert fresh
    await supabase.from('recipes').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000')

    const BATCH = 100
    let inserted = 0
    for (let i = 0; i < deduped.length; i += BATCH) {
      const batch = deduped.slice(i, i + BATCH)
      const { error } = await supabase
        .from('recipes')
        .upsert(batch, { onConflict: 'name', ignoreDuplicates: false })
      if (error) throw error
      inserted += batch.length
    }

    // ── Hours sync ────────────────────────────────────────────────────────
    // Independent of menu — its own try/catch, its own counter. If the sheet
    // tab is missing or malformed, we log and move on; menu sync still ships.
    let hoursSynced = 0
    let hoursError: string | null = null
    try {
      const rows = await fetchHoursRows()
      if (rows.length === 0) {
        hoursError = 'No parseable rows in Hours tab'
      } else {
        // Refuse to clobber if we got suspiciously few rows (matches the
        // menu-sync defensive guard recommended in audit P1-6).
        if (rows.length < 3) {
          hoursError = `Refused: only ${rows.length} hours rows parsed (likely sheet error)`
        } else {
          // Wipe + reinsert per location to get clean state. We delete by
          // location so a row removed from the sheet disappears from the DB.
          const locations = Array.from(new Set(rows.map(r => r.location)))
          for (const loc of locations) {
            await supabase.from('distillery_hours').delete().eq('location', loc)
          }
          const { error: insErr } = await supabase
            .from('distillery_hours')
            .insert(rows as any)
          if (insErr) {
            hoursError = `Hours insert failed: ${insErr.message}`
          } else {
            hoursSynced = rows.length
          }
        }
      }
    } catch (e: any) {
      hoursError = `Hours sync failed: ${e?.message ?? 'unknown'}`
    }

    return NextResponse.json({
      success:    true,
      synced:     inserted,
      total:      deduped.length,
      duplicates: recipes.length - deduped.length,
      sections:   sectionOrder.size,
      hoursSynced,
      hoursError,
      message:    `Synced ${inserted} recipes across ${sectionOrder.size} sections${hoursSynced ? `, ${hoursSynced} hours rows` : ''}${hoursError ? ` (hours: ${hoursError})` : ''}`,
    })
  } catch (err: any) {
    console.error('Menu sync error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
