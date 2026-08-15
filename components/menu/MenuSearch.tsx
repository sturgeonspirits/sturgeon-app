// ─────────────────────────────────────────────
// Changelog
//   v2026-08-01.1 — v3.0 parity pass.
//                   • FEATURED SECTION — the Menu Section holding Sort Order 1
//                     in the Categories tab renders first under its own name,
//                     and its drinks are pulled out of the other buckets so a
//                     monthly special leads the page in both grouping modes.
//                     Change that one cell in the sheet; nothing here moves.
//                   • COLLAPSIBLE FILTERS — grouping toggle and flavor-tag
//                     chips now live in a panel that is collapsed by default on
//                     mobile and always open from `md` up. Chips are new here;
//                     they mirror v3.0's flavor nav and OR together.
//                   • 44px TAP TARGETS on every control.
//                   Sorting is untouched: recipes arrive pre-sorted
//                   (section_sort_order -> sort_order -> name) and both the
//                   By Flavor / By Spirit modes still consume that order.
//                   Data now arrives from lib/sheet-menu.ts, not Supabase, so
//                   show_on_menu / is_event_menu are gone from Recipe — the
//                   two menus are separate tabs now, not two flags on one row.
//   v2026-04-27.2 — Added sticky jump-to-section pill bar above the recipe
//                   list. Tapping a category pill smooth-scrolls to that
//                   section. Bar appears in both grouping modes and only
//                   surfaces categories that actually have matches under
//                   the current search.
//   v2026-04-27.1 — Added "By Flavor" / "By Spirit" grouping toggle.
//                   New default view buckets recipes into 6 flavor categories
//                   (Bright & Citrusy, Boozy & Spirit-Forward, Fruity &
//                   Tropical, Herbal & Botanical, Sweet & Rich, Smoky &
//                   Bitter). A recipe can appear in multiple categories.
//                   "By Spirit" preserves the previous menu_section grouping.
// ─────────────────────────────────────────────

'use client'

import { useMemo, useState } from 'react'
import { FLAVOR_CATEGORIES, categorizeRecipe } from '@/lib/flavor-categories'

interface Recipe {
  id: string
  name: string
  menu_section: string | null
  menu_ingredients: string | null
  price: number | null
  flavor_tags: string[] | null
  glassware: string | null
}

interface Props {
  regularRecipes: Recipe[]
  eventRecipes: Recipe[]
  /** Menu Section with Sort Order 1 in the Categories tab. '' disables it. */
  featuredSection?: string
}

type GroupMode = 'flavor' | 'spirit'

/** Cap on the chip list — the tag vocabulary has a long tail of one-offs. */
const MAX_TAG_CHIPS = 18

export default function MenuSearch({
  regularRecipes,
  eventRecipes,
  featuredSection = '',
}: Props) {
  const [query, setQuery] = useState('')
  const [isEventMenu, setIsEventMenu] = useState(false)
  const [groupMode, setGroupMode] = useState<GroupMode>('flavor')
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)

  const activeRecipes = isEventMenu ? eventRecipes : regularRecipes

  /** Most common flavor tags on the menu currently being viewed. */
  const tagChips = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of activeRecipes) {
      for (const t of r.flavor_tags ?? []) {
        const k = t.trim().toLowerCase()
        if (k) counts.set(k, (counts.get(k) ?? 0) + 1)
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, MAX_TAG_CHIPS)
      .map(([tag]) => tag)
  }, [activeRecipes])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return activeRecipes.filter(r => {
      const matchesText =
        !q ||
        r.name.toLowerCase().includes(q) ||
        (r.menu_ingredients ?? '').toLowerCase().includes(q) ||
        (r.flavor_tags ?? []).some(t => t.toLowerCase().includes(q)) ||
        (r.glassware ?? '').toLowerCase().includes(q)

      // OR across selected tags, matching v3.0's flavor filter.
      const matchesTags =
        activeTags.length === 0 ||
        (r.flavor_tags ?? []).some(t => activeTags.includes(t.trim().toLowerCase()))

      return matchesText && matchesTags
    })
  }, [activeRecipes, query, activeTags])

  // Build sections — either by flavor category (a recipe can appear in
  // multiple buckets) or by the original menu_section, preserving the
  // incoming sort order for the latter.
  const { sections, sectionNames } = useMemo(() => {
    const map: Record<string, Recipe[]> = {}
    const order: string[] = []

    // Featured is carved out first so it can't also appear further down the
    // page. Compared case-insensitively because section names in the sheet are
    // hand-typed and drift in case.
    const featuredKey = featuredSection.trim().toLowerCase()
    const isFeatured = (r: Recipe) =>
      featuredKey !== '' &&
      (r.menu_section ?? '').trim().toLowerCase() === featuredKey

    const featuredItems = featuredKey ? filtered.filter(isFeatured) : []
    const rest = featuredKey ? filtered.filter(r => !isFeatured(r)) : filtered

    if (featuredItems.length > 0) {
      map[featuredSection] = featuredItems
      order.push(featuredSection)
    }

    if (groupMode === 'flavor') {
      // Pre-seed all 6 flavor buckets in canonical order so categories with
      // matches always appear in the same sequence.
      for (const cat of FLAVOR_CATEGORIES) {
        if (map[cat]) continue // featured already claimed this name
        map[cat] = []
        order.push(cat)
      }
      for (const r of rest) {
        const cats = categorizeRecipe(r)
        if (cats.length === 0) {
          if (!map['Other']) {
            map['Other'] = []
            order.push('Other')
          }
          map['Other'].push(r)
        } else {
          for (const c of cats) map[c].push(r)
        }
      }
      // Strip empty buckets so we don't render section headers with nothing
      // under them.
      const trimmedOrder = order.filter(s => map[s] && map[s].length > 0)
      return { sections: map, sectionNames: trimmedOrder }
    }

    // Spirit/section mode — preserve the incoming ordering.
    for (const r of rest) {
      const s = r.menu_section ?? 'Other'
      if (!map[s]) {
        map[s] = []
        order.push(s)
      }
      map[s].push(r)
    }
    return { sections: map, sectionNames: order }
  }, [filtered, groupMode, featuredSection])

  const activeFilterCount = activeTags.length
  const featuredKey = featuredSection.trim().toLowerCase()

  function toggleTag(tag: string) {
    setActiveTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
    )
  }

  function clearAll() {
    setQuery('')
    setActiveTags([])
  }

  return (
    <>
      {/* Menu toggle — Menu_Public tab vs. Menu_Event tab.
          Stays outside the collapsible panel: it switches which menu you're
          reading, which is navigation, not filtering. */}
      <div className="flex items-center bg-[#F1F1E7] rounded-xl p-1 mb-3 gap-1">
        <button
          onClick={() => {
            setIsEventMenu(false)
            clearAll()
          }}
          className={`flex-1 min-h-[44px] text-sm font-semibold py-2 rounded-lg transition-all ${
            !isEventMenu
              ? 'bg-[#FFFFFF] text-[#242622] shadow-sm'
              : 'text-[#7E613F] hover:text-[#242622]'
          }`}
        >
          Cocktail Menu
        </button>
        <button
          onClick={() => {
            setIsEventMenu(true)
            clearAll()
          }}
          className={`flex-1 min-h-[44px] text-sm font-semibold py-2 rounded-lg transition-all ${
            isEventMenu
              ? 'bg-[#96321F] text-white shadow-sm'
              : 'text-[#7E613F] hover:text-[#242622]'
          }`}
        >
          ✨ Event Menu
        </button>
      </div>

      {/* Search bar */}
      <div className="relative mb-3">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C8BCA4] pointer-events-none"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name, spirit, or flavor…"
          className="w-full min-h-[44px] bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl pl-9 pr-9 py-2.5 text-sm text-[#242622] placeholder-[#C8BCA4] focus:outline-none focus:border-[#96321F] transition-colors"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-[#C8BCA4] hover:text-[#7E613F] transition-colors"
            aria-label="Clear search"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Collapsible filter panel ──────────────────────────────────────
          Collapsed by default on mobile so the drink list starts higher up
          the screen; always open from `md` where there's room for it. */}
      <button
        type="button"
        onClick={() => setFiltersOpen(o => !o)}
        aria-expanded={filtersOpen}
        aria-controls="menu-filters"
        className="md:hidden w-full min-h-[44px] flex items-center justify-between px-4 mb-3 bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl text-sm font-semibold text-[#7E613F] active:scale-[0.99] transition-transform"
      >
        <span>
          Group &amp; Filter
          {activeFilterCount > 0 && (
            <span className="ml-2 text-[11px] bg-[#96321F] text-white rounded-full px-2 py-0.5 tabular-nums">
              {activeFilterCount}
            </span>
          )}
        </span>
        <span
          aria-hidden="true"
          className={`transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
        >
          ▾
        </span>
      </button>

      <div
        id="menu-filters"
        className={`${filtersOpen ? 'block' : 'hidden'} md:block mb-5`}
      >
        {/* Group-mode toggle — By Flavor (default) vs. By Spirit */}
        <div className="flex items-center bg-[#F1F1E7] rounded-xl p-1 mb-3 gap-1">
          <button
            onClick={() => setGroupMode('flavor')}
            className={`flex-1 min-h-[44px] text-xs font-semibold py-1.5 rounded-lg transition-all ${
              groupMode === 'flavor'
                ? 'bg-[#FFFFFF] text-[#242622] shadow-sm'
                : 'text-[#7E613F] hover:text-[#242622]'
            }`}
            aria-pressed={groupMode === 'flavor'}
          >
            By Flavor
          </button>
          <button
            onClick={() => setGroupMode('spirit')}
            className={`flex-1 min-h-[44px] text-xs font-semibold py-1.5 rounded-lg transition-all ${
              groupMode === 'spirit'
                ? 'bg-[#FFFFFF] text-[#242622] shadow-sm'
                : 'text-[#7E613F] hover:text-[#242622]'
            }`}
            aria-pressed={groupMode === 'spirit'}
          >
            By Spirit
          </button>
        </div>

        {/* Flavor-tag chips — OR together, like v3.0's flavor nav. */}
        {tagChips.length > 1 && (
          <div>
            <p className="text-[11px] font-bold text-[#9E8F7E] uppercase tracking-[0.14em] mb-2">
              Flavor
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tagChips.map(tag => {
                const on = activeTags.includes(tag)
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    aria-pressed={on}
                    className={`min-h-[44px] text-[11px] font-medium px-3 rounded-full border capitalize transition-colors ${
                      on
                        ? 'bg-[#96321F] border-[#96321F] text-[#FFFFFF]'
                        : 'bg-[#FFFFFF] border-[#D4CFC3] text-[#7E613F] hover:border-[#96321F] hover:text-[#96321F]'
                    }`}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Count */}
      <p className="text-xs text-[#9E8F7E] mb-4">
        {activeRecipes.length}{' '}
        {activeRecipes.length === 1 ? 'cocktail' : 'cocktails'}
        {isEventMenu ? " on tonight's event menu" : ' · crafted in Oshkosh'}
        {groupMode === 'flavor' && ' · grouped by flavor'}
      </p>

      {(query.trim() || activeTags.length > 0) && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-[#9E8F7E]">
            {filtered.length} {filtered.length === 1 ? 'cocktail' : 'cocktails'}{' '}
            found
          </p>
          <button
            onClick={clearAll}
            className="min-h-[44px] px-1 text-xs text-[#96321F] font-semibold hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Jump-to-section pill bar — sticky so it stays reachable as the
          user scrolls. Only renders when there's more than one section
          actually visible (a single bucket needs no nav). */}
      {sectionNames.length > 1 && (
        <div className="sticky top-0 z-20 -mx-4 px-4 py-2 mb-4 bg-[#FAF7EC]/95 backdrop-blur supports-[backdrop-filter]:bg-[#FAF7EC]/80 border-b border-[#EDE9DC]">
          <div className="flex gap-2 overflow-x-auto -my-1 py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {sectionNames.map(section => (
              <button
                key={section}
                onClick={() => scrollToSection(section)}
                className="shrink-0 min-h-[44px] text-xs font-semibold px-3 rounded-full bg-[#FFFFFF] border border-[#D4CFC3] text-[#7E613F] hover:bg-[#96321F] hover:text-white hover:border-[#96321F] active:scale-95 transition-all whitespace-nowrap"
              >
                {section}
                <span className="ml-1.5 text-[10px] opacity-70 tabular-nums">
                  {sections[section].length}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No results */}
      {filtered.length === 0 && (
        <div className="text-center py-16 bg-[#FFFFFF] rounded-2xl border border-[#D4CFC3]">
          <p className="text-4xl mb-3">
            {query || activeTags.length ? '🔍' : '🍹'}
          </p>
          {query || activeTags.length ? (
            <>
              <p className="font-semibold text-[#242622] mb-1">
                No cocktails found
              </p>
              <p className="text-sm text-[#7E613F]">
                Try a different name, spirit, or flavor
              </p>
              <button
                onClick={clearAll}
                className="mt-4 min-h-[44px] text-sm text-[#96321F] font-semibold hover:underline"
              >
                Clear all
              </button>
            </>
          ) : (
            <>
              <p className="font-semibold text-[#242622] mb-1">
                {isEventMenu ? 'No event menu tonight' : 'Menu coming soon'}
              </p>
              <p className="text-sm text-[#7E613F]">
                {isEventMenu
                  ? 'Check back closer to the event'
                  : 'The cocktail menu will appear here shortly'}
              </p>
            </>
          )}
        </div>
      )}

      {/* Recipe list */}
      <div className="space-y-8">
        {sectionNames.map(section => {
          const isFeaturedSection =
            featuredKey !== '' && section.trim().toLowerCase() === featuredKey

          return (
            <section
              key={section}
              id={sectionId(section)}
              // scroll-mt offsets the smooth-scroll target by the height of the
              // sticky pill bar so the section header isn't hidden under it.
              className="scroll-mt-20"
            >
              {isFeaturedSection && (
                <p className="text-[10px] font-bold text-[#87A67F] uppercase tracking-[0.2em] mb-1">
                  Featured
                </p>
              )}
              <div className="flex items-center gap-3 mb-3">
                <p className="text-xs font-bold text-[#96321F] uppercase tracking-[0.18em]">
                  {section}
                </p>
                <span className="text-[10px] text-[#9E8F7E] tabular-nums">
                  {sections[section].length}
                </span>
                <div className="flex-1 h-px bg-[#D4CFC3]" />
              </div>

              <div className="space-y-2">
                {sections[section].map(r => (
                  // When grouping by flavor a single recipe can appear in
                  // multiple sections, so the React key needs the section
                  // prefix to stay unique.
                  <div
                    key={`${section}:${r.id}`}
                    className={`bg-[#FFFFFF] border rounded-2xl p-4 ${
                      isFeaturedSection
                        ? 'border-[#87A67F]/50'
                        : 'border-[#D4CFC3]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#242622]">
                          <HighlightMatch text={r.name} query={query} />
                        </p>
                        {r.menu_ingredients && (
                          <p className="text-xs text-[#7E613F] mt-1 leading-relaxed">
                            <HighlightMatch
                              text={r.menu_ingredients}
                              query={query}
                            />
                          </p>
                        )}
                        {((r.flavor_tags ?? []).length > 0 || r.glassware) && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {r.glassware && (
                              <span className="text-[10px] bg-[#EDE9DC] text-[#7E613F] px-2 py-0.5 rounded-full">
                                {r.glassware}
                              </span>
                            )}
                            {(r.flavor_tags ?? [])
                              .slice(0, 5)
                              .map((tag: string) => (
                                <span
                                  key={tag}
                                  className="text-[10px] bg-[#87A67F]/12 text-[#87A67F] px-2 py-0.5 rounded-full font-medium"
                                >
                                  {tag}
                                </span>
                              ))}
                          </div>
                        )}
                      </div>
                      {r.price && (
                        <p className="text-base font-bold text-[#242622] shrink-0">
                          ${Number(r.price).toFixed(0)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}

/** Build a stable, URL-safe id from a section name (used for scroll anchors). */
function sectionId(name: string): string {
  return (
    'section-' +
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  )
}

/** Smooth-scroll to a section by name. Falls back gracefully if the element
 *  isn't found (shouldn't happen — the pill bar is built from sectionNames). */
function scrollToSection(name: string) {
  const el = document.getElementById(sectionId(name))
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[#96321F]/15 text-[#96321F] rounded-sm not-italic font-medium px-0.5">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  )
}
