import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Google Sheet ID
const SHEET_ID = '1TO0jjaBG32-sEYNJ06zQdkO5Av9YOCg1_RLVumlgwEc'

// Tab URLs — use sheet name so we never need to chase GIDs
const RECIPES_URL    = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`
const CATEGORIES_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Categories`

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

    return NextResponse.json({
      success:    true,
      synced:     inserted,
      total:      deduped.length,
      duplicates: recipes.length - deduped.length,
      sections:   sectionOrder.size,
      message:    `Synced ${inserted} recipes across ${sectionOrder.size} sections`,
    })
  } catch (err: any) {
    console.error('Menu sync error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
