import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Google Sheet ID — Recipes tab (gid=0)
const SHEET_ID  = '1TO0jjaBG32-sEYNJ06zQdkO5Av9YOCg1_RLVumlgwEc'
const SHEET_GID = '0'
const CSV_URL   = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`

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

export async function POST(request: Request) {
  // Verify this is coming from staff (require service auth header)
  const authHeader = request.headers.get('x-sync-secret')
  const syncSecret = process.env.SYNC_SECRET ?? 'sturgeon-sync'
  if (authHeader !== syncSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Fetch CSV from Google Sheets
    const res = await fetch(CSV_URL, { cache: 'no-store' })
    if (!res.ok) throw new Error(`Google Sheets fetch failed: ${res.status}`)

    const csv = await res.text()
    const lines = csv.split('\n').filter(l => l.trim())
    const header = parseCSVLine(lines[0])

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

      const ingredients = parseIngredients([
        cols[8],  cols[9],  cols[10], cols[11], cols[12],
        cols[13], cols[14], cols[15], cols[16], cols[17],
      ])

      recipes.push({
        name,
        show_on_menu:     parseBool(cols[1]),
        price:            parsePrice(cols[2]),
        menu_section:     cols[3] || null,
        tags:             parseTags(cols[4]),
        flavor_tags:      parseTags(cols[5]),
        sort_order:       parseInt(cols[6]) || 999,
        menu_ingredients: cols[7] || null,
        ingredients,
        instructions:     cols[18] || null,
        photo_url:        cols[19] || null,
        glassware:        cols[20] || null,
        author:           cols[22] || null,
        recipe_date:      cols[23] || null,
        notes:            cols[25] || null,
        is_event_menu:    parseBool(cols[26]),
        grocery_override: cols[27] || null,
        is_active:        true,
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
      message:    `Synced ${inserted} recipes from Google Sheets`,
    })
  } catch (err: any) {
    console.error('Menu sync error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
