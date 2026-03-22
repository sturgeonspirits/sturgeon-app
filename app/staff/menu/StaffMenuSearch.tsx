'use client'

import { useState, useMemo } from 'react'

interface Recipe {
  id: string
  name: string
  menu_section: string | null
  menu_ingredients: string | null
  ingredients: string[] | null
  instructions: string | null
  price: number | null
  flavor_tags: string[] | null
  glassware: string | null
  show_on_menu: boolean | null
  notes: string | null
  author: string | null
}

interface Props {
  recipes: Recipe[]
}

export default function StaffMenuSearch({ recipes }: Props) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return recipes
    return recipes.filter(r =>
      r.name.toLowerCase().includes(q)
      || (r.menu_ingredients ?? '').toLowerCase().includes(q)
      || (r.ingredients ?? []).some(i => i.toLowerCase().includes(q))
      || (r.instructions ?? '').toLowerCase().includes(q)
      || (r.flavor_tags ?? []).some(t => t.toLowerCase().includes(q))
      || (r.glassware ?? '').toLowerCase().includes(q)
    )
  }, [recipes, query])

  const sections = useMemo(() => {
    const map: Record<string, Recipe[]> = {}
    for (const r of filtered) {
      const s = r.menu_section ?? 'Uncategorized'
      if (!map[s]) map[s] = []
      map[s].push(r)
    }
    return map
  }, [filtered])

  return (
    <>
      {/* Search bar */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C8BCA4] pointer-events-none"
          width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name, spirit, flavor, or ingredient…"
          className="w-full bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl pl-9 pr-9 py-2.5 text-sm text-[#242622] placeholder-[#C8BCA4] focus:outline-none focus:border-[#96321F] transition-colors"
        />
        {query && (
          <button onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C8BCA4] hover:text-[#7E613F]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {query.trim() && (
        <p className="text-xs text-[#9E8F7E] mb-3">
          {filtered.length} {filtered.length === 1 ? 'recipe' : 'recipes'} found
        </p>
      )}

      {/* No results */}
      {filtered.length === 0 && (
        <div className="text-center py-12 bg-[#FFFFFF] rounded-2xl border border-[#D4CFC3]">
          <p className="text-3xl mb-2">🔍</p>
          <p className="font-semibold text-[#242622] mb-1">No recipes found</p>
          <button onClick={() => setQuery('')} className="text-sm text-[#96321F] font-semibold hover:underline mt-1">
            Clear search
          </button>
        </div>
      )}

      {/* Recipe list */}
      {Object.entries(sections).map(([section, items]) => (
        <section key={section} className="mb-6">
          <h2 className="text-xs font-bold text-[#96321F] uppercase tracking-widest mb-2">
            {section} ({items.length})
          </h2>
          <div className="space-y-2">
            {items.map(r => {
              const ingList = (r.ingredients ?? []).filter(Boolean)
              // Show expand arrow if ANY detail field has content
              const hasDetail = !!(
                r.menu_ingredients || ingList.length > 0 ||
                r.instructions || r.notes || r.author
              )

              return (
                <details key={r.id} className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl overflow-hidden group">
                  <summary className="px-4 py-3 flex items-center justify-between cursor-pointer list-none select-none hover:bg-[#F9F8F2] transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[#242622] truncate">{r.name}</p>
                        {r.show_on_menu && (
                          <span className="text-[10px] bg-[#87A67F]/15 text-[#87A67F] font-medium px-2 py-0.5 rounded-full shrink-0">
                            On Menu
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#9E8F7E] mt-0.5">
                        {[r.glassware, ...(r.flavor_tags ?? []).slice(0, 3)].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-3 shrink-0">
                      {r.price && (
                        <span className="text-sm font-bold text-[#242622]">${r.price}</span>
                      )}
                      {hasDetail && (
                        <svg className="text-[#C8BCA4] transition-transform group-open:rotate-180"
                          width="14" height="14" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      )}
                    </div>
                  </summary>

                  {hasDetail && (
                    <div className="px-4 pb-4 pt-2 border-t border-[#EDE9DC] space-y-3">

                      {/* Full build — volumes and measurements for staff */}
                      {ingList.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-[#96321F] uppercase tracking-widest mb-1.5">Build</p>
                          <ul className="space-y-1">
                            {ingList.map((ing, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-[#242622]">
                                <span className="text-[#96321F] mt-0.5 shrink-0">•</span>
                                <span>{ing}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {r.instructions && (
                        <div>
                          <p className="text-[10px] font-bold text-[#96321F] uppercase tracking-widest mb-1.5">Method</p>
                          <p className="text-xs text-[#242622] leading-relaxed whitespace-pre-line">{r.instructions}</p>
                        </div>
                      )}

                      {/* Customer-facing description — what appears on the printed menu */}
                      {r.menu_ingredients && (
                        <div className="pt-1 border-t border-[#EDE9DC]">
                          <p className="text-[10px] font-bold text-[#9E8F7E] uppercase tracking-widest mb-1">On Menu</p>
                          <p className="text-xs text-[#9E8F7E] italic">{r.menu_ingredients}</p>
                        </div>
                      )}

                      {(r.notes || r.author) && (
                        <div className="pt-1 border-t border-[#EDE9DC] flex items-start justify-between gap-4">
                          {r.notes && <p className="text-xs text-[#9E8F7E] italic flex-1">{r.notes}</p>}
                          {r.author && <p className="text-xs text-[#9E8F7E] shrink-0">by {r.author}</p>}
                        </div>
                      )}
                    </div>
                  )}
                </details>
              )
            })}
          </div>
        </section>
      ))}
    </>
  )
}
