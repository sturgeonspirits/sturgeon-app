'use client'

import { useState, useMemo } from 'react'

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
  recipes: Recipe[]
}

export default function MenuSearch({ recipes }: Props) {
  const [query, setQuery]             = useState('')
  const [activeTag, setActiveTag]     = useState<string | null>(null)

  // Collect all unique flavor tags across recipes, sorted
  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const r of recipes) {
      for (const t of r.flavor_tags ?? []) set.add(t)
    }
    return Array.from(set).sort()
  }, [recipes])

  // Filter logic
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return recipes.filter(r => {
      const matchesText = !q
        || r.name.toLowerCase().includes(q)
        || (r.menu_ingredients ?? '').toLowerCase().includes(q)
      const matchesTag = !activeTag || (r.flavor_tags ?? []).includes(activeTag)
      return matchesText && matchesTag
    })
  }, [recipes, query, activeTag])

  // Group filtered recipes by section
  const sections = useMemo(() => {
    const map: Record<string, Recipe[]> = {}
    for (const r of filtered) {
      const s = r.menu_section ?? 'Other'
      if (!map[s]) map[s] = []
      map[s].push(r)
    }
    return map
  }, [filtered])

  const sectionNames = Object.keys(sections).sort()
  const hasResults   = filtered.length > 0

  function clearFilters() {
    setQuery('')
    setActiveTag(null)
  }

  const isFiltering = query.trim() !== '' || activeTag !== null

  return (
    <>
      {/* ── Search bar ─────────────────────────────────── */}
      <div className="relative mb-4">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C8BCA4] pointer-events-none"
          width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name or spirit…"
          className="w-full bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl pl-9 pr-9 py-2.5 text-sm text-[#242622] placeholder-[#C8BCA4] focus:outline-none focus:border-[#96321F] transition-colors"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C8BCA4] hover:text-[#7E613F] transition-colors"
            aria-label="Clear search"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* ── Flavor tag chips ───────────────────────────── */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`text-[11px] font-medium px-3 py-1 rounded-full border transition-colors ${
                activeTag === tag
                  ? 'bg-[#96321F] border-[#96321F] text-[#FFFFFF]'
                  : 'bg-[#FFFFFF] border-[#D4CFC3] text-[#7E613F] hover:border-[#96321F] hover:text-[#96321F]'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* ── Results count / clear ──────────────────────── */}
      {isFiltering && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-[#9E8F7E]">
            {filtered.length} {filtered.length === 1 ? 'cocktail' : 'cocktails'} found
          </p>
          <button
            onClick={clearFilters}
            className="text-xs text-[#96321F] font-semibold hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* ── No results ────────────────────────────────── */}
      {!hasResults && (
        <div className="text-center py-16 bg-[#FFFFFF] rounded-2xl border border-[#D4CFC3]">
          <p className="text-4xl mb-3">🔍</p>
          <p className="font-semibold text-[#242622] mb-1">No cocktails found</p>
          <p className="text-sm text-[#7E613F]">Try a different name or flavor</p>
          <button
            onClick={clearFilters}
            className="mt-4 text-sm text-[#96321F] font-semibold hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* ── Recipe list ───────────────────────────────── */}
      {hasResults && (
        <div className="space-y-8">
          {sectionNames.map(section => (
            <section key={section}>
              <div className="flex items-center gap-3 mb-3">
                <p className="text-xs font-bold text-[#96321F] uppercase tracking-[0.18em]">{section}</p>
                <div className="flex-1 h-px bg-[#D4CFC3]" />
              </div>

              <div className="space-y-2">
                {sections[section].map(r => (
                  <div
                    key={r.id}
                    className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-4"
                  >
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
                        <div className="flex flex-wrap gap-1 mt-2">
                          {r.glassware && (
                            <span className="text-[10px] bg-[#EDE9DC] text-[#7E613F] px-2 py-0.5 rounded-full">
                              {r.glassware}
                            </span>
                          )}
                          {(r.flavor_tags ?? []).slice(0, 5).map((tag: string) => (
                            <button
                              key={tag}
                              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                              className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                                activeTag === tag
                                  ? 'bg-[#96321F] text-[#FFFFFF]'
                                  : 'bg-[#87A67F]/12 text-[#87A67F] hover:bg-[#87A67F]/25'
                              }`}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
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
      )}
    </>
  )
}

// Highlights matching text in a string
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
