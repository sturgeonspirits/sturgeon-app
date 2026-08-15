// ─────────────────────────────────────────────
// Changelog
//   v2026-08-01.1 — New module. Moves the Club app's consumer menu off the
//                   Supabase `recipes` table and onto the published
//                   Menu_Public / Menu_Event tabs, matching the v3.0
//                   architecture already used by the Squarespace public menu
//                   and the Ready Room event menu.
//
//                   Why: the app rendered whatever the last sync produced, so
//                   a member in the app and a guest on the website could see
//                   different drinks and different prices on the same night.
//                   Measured at the public-menu switchover: Supabase had 447
//                   drinks against the sheet's 461, and Menu_Event had ~195
//                   against the sheet's 228.
//
//                   Sort order is deliberately UNCHANGED from the Supabase
//                   query it replaces — section_sort_order, then sort_order,
//                   then name. See sortRecipes() for how each is recovered.
// ─────────────────────────────────────────────

/**
 * Published-sheet reader for the consumer menu.
 *
 * Everything here is server-side. The published CSV endpoints are public, but
 * the Club menu page is auth-gated, so nothing about this widens access to the
 * data — it only changes which copy of it we read.
 */

// Same published document the v3.0 code block reads. This is the publish-to-web
// URL, NOT the master document — only the Menu_* / Categories tabs are exposed.
const SHEET =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQWbM5xAkROvemJ6GBsbuWYV2ii3aBKe9eOWiFe2ObWbVXNRIaEK2RSiJor2vS7a2o55qDZKDb1C2YU/pub'

const URLS = {
  /** Menu_Public — rows where Show on Menu (col B) is TRUE. */
  drinks: `${SHEET}?gid=1757661159&single=true&output=csv`,
  /** Menu_Event — rows where Event Menu? (col AA) is TRUE. */
  event: `${SHEET}?gid=516839276&single=true&output=csv`,
  /** Categories — supplies section ordering and the featured section. */
  categories: `${SHEET}?gid=1969694505&single=true&output=csv`,
} as const

/** Matches v3.0's CACHE_MS. The menu does not change minute to minute. */
const REVALIDATE_SECONDS = 15 * 60

/**
 * Shape consumed by <MenuSearch>. Intentionally identical to the columns the
 * old Supabase query selected, so the component needed no data-shape changes.
 */
export interface SheetRecipe {
  id: string
  name: string
  menu_section: string | null
  menu_ingredients: string | null
  price: number | null
  flavor_tags: string[] | null
  glassware: string | null
  /** Recovered from the Categories tab; drives the primary sort. */
  section_sort_order: number
  /** Per-drink Sort Order column; drives the secondary sort. */
  sort_order: number
}

export interface SheetMenu {
  regularRecipes: SheetRecipe[]
  eventRecipes: SheetRecipe[]
  /**
   * Menu Section with Sort Order 1 in the Categories tab, or '' if no category
   * claims the slot. Rendered first and pulled out of the other buckets.
   */
  featuredSection: string
  /**
   * True when a fetch failed. The page renders its existing empty state rather
   * than a half-menu, because a partial menu is worse than an obvious outage.
   */
  failed: boolean
}

// ──────────────────────────────────────────────────────────────────────────
// CSV
// ──────────────────────────────────────────────────────────────────────────

/**
 * Full CSV parser — handles quoted fields containing commas and newlines.
 *
 * Deliberately not the line-splitting parser in app/api/sync-menu/route.ts:
 * that one splits on '\n' before parsing quotes, so a Menu Ingredients cell
 * with an embedded newline silently shears into two broken rows.
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]

    if (c === '"' && quoted && text[i + 1] === '"') {
      field += '"'
      i++
      continue
    }
    if (c === '"') {
      quoted = !quoted
      continue
    }
    if (!quoted && (c === ',' || c === '\n' || c === '\r')) {
      row.push(field)
      field = ''
      if (c === '\n' || c === '\r') {
        // Swallow the \n of a \r\n pair so it doesn't open a blank row.
        if (c === '\r' && text[i + 1] === '\n') i++
        rows.push(row)
        row = []
      }
      continue
    }
    field += c
  }

  row.push(field)
  rows.push(row)

  // Trailing blank rows are normal in a formula-filled tab.
  while (rows.length && rows[rows.length - 1].every(x => !String(x ?? '').trim())) {
    rows.pop()
  }
  return rows
}

/**
 * Header-name → column-index map, so inserting a column in the sheet doesn't
 * silently shift every field by one. Same approach as v3.0.
 */
function indexHeaders(headerRow: string[]): Record<string, number> {
  const map: Record<string, number> = {}
  headerRow.forEach((h, i) => {
    const k = String(h ?? '').trim().toLowerCase()
    if (k) map[k] = i
  })
  return map
}

async function fetchCSV(url: string): Promise<string[][]> {
  const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } })
  if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status} ${url}`)
  return parseCSV(await res.text())
}

// ──────────────────────────────────────────────────────────────────────────
// PARSING
// ──────────────────────────────────────────────────────────────────────────

/**
 * Flavor Tags arrives comma-separated on some rows and space-separated on
 * others — the master tab has both conventions live.
 *
 * The old Supabase sync split on comma only, so a space-separated cell became
 * one long pseudo-tag. That rendered as a single run-on badge and is why some
 * drinks show one wide tag today. Splitting on whichever separator is actually
 * present fixes that without needing the sheet cleaned up first.
 */
function parseTags(val: string): string[] {
  const s = String(val ?? '').trim()
  if (!s) return []
  const parts = s.includes(',') ? s.split(',') : s.split(/\s+/)
  return parts.map(t => t.trim()).filter(Boolean)
}

function parsePrice(val: string): number | null {
  const n = parseFloat(String(val ?? '').replace(/[^0-9.]/g, ''))
  return isFinite(n) ? n : null
}

/**
 * Categories tab → { sectionOrder, featured }.
 *
 * sectionOrder replaces the `section_sort_order` column the sync route used to
 * compute and write into Supabase. Unknown sections fall to 999, matching the
 * old `sectionOrder.get(menuSection) ?? 999`.
 */
function parseCategories(rows: string[][]): {
  sectionOrder: Map<string, number>
  featured: string
} {
  const sectionOrder = new Map<string, number>()
  let featured = ''
  let bestOrder = Infinity

  for (let i = 1; i < rows.length; i++) {
    const name = String(rows[i][0] ?? '').trim()
    if (!name) continue
    const order = parseInt(String(rows[i][1] ?? ''), 10)
    const safe = isFinite(order) ? order : 999
    sectionOrder.set(name, safe)
    if (isFinite(order) && order < bestOrder) {
      bestOrder = order
      featured = name
    }
  }

  // Only an explicit Sort Order 1 gets promoted — v3.0's rule. Without this a
  // tab whose lowest order happens to be 3 would silently gain a featured
  // section nobody asked for.
  return { sectionOrder, featured: bestOrder <= 1 ? featured : '' }
}

const REQUIRED_COLUMNS = [
  'name',
  'price',
  'menu section',
  'tags',
  'flavor tags',
  'sort order',
  'menu ingredients',
  'spirit bucket',
] as const

/**
 * Menu_Public / Menu_Event rows → SheetRecipe[].
 *
 * `glassware` and `recipe id` are treated as optional so this ships safely
 * before the sheet gains them (see menu-public-tab.md Step 2). When Recipe ID
 * is absent we fall back to the row index, which is unique within a load —
 * name is NOT usable as a key because the master tab has live case-mismatched
 * duplicates ('Prehistoric pour' / 'Prehistoric Pour').
 */
function parseDrinks(
  rows: string[][],
  sectionOrder: Map<string, number>,
  tabLabel: string,
): SheetRecipe[] {
  if (!rows.length) return []

  const h = indexHeaders(rows[0])
  const missing = REQUIRED_COLUMNS.filter(n => !(n in h))
  if (missing.length) {
    throw new Error(`${tabLabel} is missing column(s): ${missing.join(', ')}`)
  }

  const hasGlassware = 'glassware' in h
  const hasId = 'recipe id' in h
  const out: SheetRecipe[] = []

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const name = String(r[h['name']] ?? '').trim()
    if (!name) continue

    const section = String(r[h['menu section']] ?? '').trim()
    const rawId = hasId ? String(r[h['recipe id']] ?? '').trim() : ''
    const sortOrder = parseInt(String(r[h['sort order']] ?? ''), 10)

    out.push({
      id: rawId || `${tabLabel}-row-${i}`,
      name,
      menu_section: section || null,
      menu_ingredients: String(r[h['menu ingredients']] ?? '').trim() || null,
      price: parsePrice(r[h['price']]),
      flavor_tags: parseTags(r[h['flavor tags']]),
      glassware: hasGlassware
        ? String(r[h['glassware']] ?? '').trim() || null
        : null,
      section_sort_order: section ? (sectionOrder.get(section) ?? 999) : 999,
      sort_order: isFinite(sortOrder) ? sortOrder : 999,
    })
  }

  return out
}

/**
 * Reproduces the exact ordering of the Supabase query this replaces:
 *
 *   .order('section_sort_order').order('sort_order').order('name')
 *
 * MenuSearch's "By Spirit" mode builds its sections by walking this array in
 * order, so section sequence on screen depends on this sort — not on the
 * order rows happen to sit in the sheet.
 */
function sortRecipes(recipes: SheetRecipe[]): SheetRecipe[] {
  return [...recipes].sort(
    (a, b) =>
      a.section_sort_order - b.section_sort_order ||
      a.sort_order - b.sort_order ||
      a.name.localeCompare(b.name),
  )
}

// ──────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ──────────────────────────────────────────────────────────────────────────

/**
 * Fetch and assemble the consumer menu.
 *
 * All three tabs are requested in parallel. Categories is non-fatal: without it
 * every section falls to 999 and sorts alphabetically by name within one bucket,
 * which is degraded but readable. A failure on Menu_Public IS fatal, because a
 * silently-short menu is the precise bug this module exists to prevent.
 */
export async function fetchSheetMenu(): Promise<SheetMenu> {
  const empty: SheetMenu = {
    regularRecipes: [],
    eventRecipes: [],
    featuredSection: '',
    failed: true,
  }

  const [drinksRes, eventRes, catsRes] = await Promise.allSettled([
    fetchCSV(URLS.drinks),
    fetchCSV(URLS.event),
    fetchCSV(URLS.categories),
  ])

  let sectionOrder = new Map<string, number>()
  let featuredSection = ''
  if (catsRes.status === 'fulfilled') {
    const parsed = parseCategories(catsRes.value)
    sectionOrder = parsed.sectionOrder
    featuredSection = parsed.featured
  } else {
    console.warn('[sheet-menu] Categories unavailable:', catsRes.reason)
  }

  if (drinksRes.status !== 'fulfilled') {
    console.error('[sheet-menu] Menu_Public fetch failed:', drinksRes.reason)
    return empty
  }

  let regularRecipes: SheetRecipe[]
  try {
    regularRecipes = sortRecipes(
      parseDrinks(drinksRes.value, sectionOrder, 'Menu_Public'),
    )
  } catch (e) {
    console.error('[sheet-menu]', (e as Error).message)
    return empty
  }

  // The event menu is allowed to fail on its own. An empty event menu is a
  // real, common state ("No event menu tonight"), so it must not take the
  // cocktail menu down with it.
  let eventRecipes: SheetRecipe[] = []
  if (eventRes.status === 'fulfilled') {
    try {
      eventRecipes = sortRecipes(
        parseDrinks(eventRes.value, sectionOrder, 'Menu_Event'),
      )
    } catch (e) {
      console.error('[sheet-menu]', (e as Error).message)
    }
  } else {
    console.warn('[sheet-menu] Menu_Event unavailable:', eventRes.reason)
  }

  return { regularRecipes, eventRecipes, featuredSection, failed: false }
}
