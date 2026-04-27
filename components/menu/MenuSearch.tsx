// ─────────────────────────────────────────────
// Changelog
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
  show_on_menu?: boolean
  is_event_menu?: boolean
}

interface Props {
  regularRecipes: Recipe[]
  eventRecipes:   Recipe[]
}

type GroupMode = 'flavor' | 'spirit'

export default function MenuSearch({ regularRecipes, eventRecipes }: Props) {
  const [query,       setQuery]       = useState('')
  const [isEventMenu, setIsEventMenu] = useState(false)
  const [groupMode,   setGroupMode]   = useState<GroupMode>('flavor')

  const activeRecipes = isEventMenu ? eventRecipes : regularRecipes

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return activeRecipes
    return activeRecipes.filter(r =>
      r.name.toLowerCase().includes(q)
      || (r.menu_ingredients ?? '').toLowerCase().includes(q)
      || (r.flavor_tags ?? []).some(t => t.toLowerCase().includes(q))
      || (r.glassware ?? '').toLowerCase().includes(q)
    )
  }, [activeRecipes, query])

  // Build sections — either by flavor category (a recipe can appear in
  // multiple buckets) or by the original menu_section, preserving the
  // server's sort order for the latter.
  const { sections, sectionNames } = useMemo(() => {
    const map:   Record<string, Recipe[]> = {}
    const order: string[] = []

    if (groupMode === 'flavor') {
      // Pre-seed all 6 flavor buckets in canonical order so categories with
      // matches always appear in the same sequence.
      for (const cat of FLAVOR_CATEGORIES) {
        map[cat] = []
        order.push(cat)
      }
      for (const r of filtered) {
        const cats = categorizeRecipe(r)
        if (cats.length === 0) {
          if (!map['Other']) { map['Other'] = []; order.push('Other') }
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

    // Spirit/section mode — preserve the server's ordering.
    for (const r of filtered) {
      const s = r.menu_section ?? 'Other'
      if (!map[s]) { map[s] = []; order.push(s) }
      map[s].push(r)
    }
    return { sections: map, sectionNames: order }
  }, [filtered, groupMode])

  return (
    <>
      {/* Menu toggle — switches between show_on_menu (col B) and is_event_menu (col AA) */}
      <div className="flex items-center bg-[#F1F1E7] rounded-xl p-1 mb-3 gap-1">
        <button
          onClick={() => { setIsEventMenu(false); setQuery('') }}
          className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-all ${
            !isEventMenu
              ? 'bg-[#FFFFFF] text-[#242622] shadow-sm'
              : 'text-[#7E613F] hover:text-[#242622]'
          }`}
        >
          Cocktail Menu
        </button>
        <button
          onClick={() => { setIsEventMenu(true); setQuery('') }}
          className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-all ${
            isEventMenu
              ? 'bg-[#96321F] text-white shadow-sm'
              : 'text-[#7E613F] hover:text-[#242622]'
          }`}
        >
          ✨ Event Menu
        </button>
      </div>

      {/* Group-mode toggle — By Flavor (default) vs. By Spirit */}
      <div className="flex items-center bg-[#F1F1E7] rounded-xl p-1 mb-5 gap-1">
        <button
          onClick={() => setGroupMode('flavor')}
          className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-all ${
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
          className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-all ${
            groupMode === 'spirit'
              ? 'bg-[#FFFFFF] text-[#242622] shadow-sm'
              : 'text-[#7E613F] hover:text-[#242622]'
          }`}
          aria-pressed={groupMode === 'spirit'}
        >
          By Spirit
        </button>
      </div>

      {/* Count */}
      <p className="text-xs text-[#9E8F7E] mb-4">
        {activeRecipes.length} {activeRecipes.length === 1 ? 'cocktail' : 'cocktails'}
        {isEventMenu ? ' on tonight\'s event menu' : ' · crafted in Oshkosh'}
        {groupMode === 'flavor' && ' · grouped by flavor'}
      </p>

      {/* Search bar */}
      <div className="relative mb-5">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C8BCA4] pointer-events-none"
          width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name, spirit, or flavor…"
          className="w-full bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl pl-9 pr-9 py-2.5 text-sm text-[#242622] placeholder-[#C8BCA4] focus:outline-none focus:border-[#96321F] transition-colors"
        />
        {query && (
          <button onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C8BCA4] hover:text-[#7E613F] transition-colors"
            aria-label="Clear search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {query.trim() && (
        <p className="text-xs text-[#9E8F7E] mb-4">
          {filtered.length} {filtered.length === 1 ? 'cocktail' : 'cocktails'} found
        </p>
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
                className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#FFFFFF] border border-[#D4CFC3] text-[#7E613F] hover:bg-[#96321F] hover:text-white hover:border-[#96321F] active:scale-95 transition-all whitespace-nowrap"
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
          <p className="text-4xl mb-3">{query ? '🔍' : '🍹'}</p>
          {query ? (
            <>
              <p className="font-semibold text-[#242622] mb-1">No cocktails found</p>
              <p className="text-sm text-[#7E613F]">Try a different name, spirit, or flavor</p>
              <button onClick={() => setQuery('')}
                className="mt-4 text-sm text-[#96321F] font-semibold hover:underline">
                Clear search
              </button>
            </>
          ) : (
            <>
              <p className="font-semibold text-[#242622] mb-1">
                {isEventMenu ? 'No event menu tonight' : 'Menu coming soon'}
              </p>
              <p className="text-sm text-[#7E613F]">
                {isEventMenu ? 'Check back closer to the event' : 'Staff will sync the cocktail menu shortly'}
              </p>
            </>
          )}
        </div>
      )}

      {/* Recipe list */}
      <div className="space-y-8">
        {sectionNames.map(section => (
          <section
            key={section}
            id={sectionId(section)}
            // scroll-mt offsets the smooth-scroll target by the height of the
            // sticky pill bar so the section header isn't hidden under it.
            className="scroll-mt-20"
          >
            <div className="flex items-center gap-3 mb-3">
              <p className="text-xs font-bold text-[#96321F] uppercase tracking-[0.18em]">{section}</p>
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
                <div key={`${section}:${r.id}`} className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#242622]">
                        <HighlightMatch text={r.name} query={query} />
                      </p>
                      {r.menu_ingredients && (
                        <p className="text-xs text-[#7E613F] mt-1 leading-relaxed">
                          <HighlightMatch text={r.menu_ingredients} query={query} />
                        </p>
                      )}
                      {(r.flavor_tags ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {r.glassware && (
                            <span className="text-[10px] bg-[#EDE9DC] text-[#7E613F] px-2 py-0.5 rounded-full">
                              {r.glassware}
                            </span>
                          )}
                          {(r.flavor_tags ?? []).slice(0, 5).map((tag: string) => (
                            <span key={tag}
                              className="text-[10px] bg-[#87A67F]/12 text-[#87A67F] px-2 py-0.5 rounded-full font-medium">
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
        ))}
      </div>
    </>
  )
}

/** Build a stable, URL-safe id from a section name (used for scroll anchors). */
function sectionId(name: string): string {
  return 'section-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
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
