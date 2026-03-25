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
  show_on_menu?: boolean
  is_event_menu?: boolean
}

interface Props {
  regularRecipes: Recipe[]
  eventRecipes:   Recipe[]
}

export default function MenuSearch({ regularRecipes, eventRecipes }: Props) {
  const [query,       setQuery]       = useState('')
  const [isEventMenu, setIsEventMenu] = useState(false)

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

  return (
    <>
      {/* Menu toggle — always visible, switches between show_on_menu (col B) and is_event_menu (col AA) */}
      <div className="flex items-center bg-[#F1F1E7] rounded-xl p-1 mb-5 gap-1">
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

      {/* Count */}
      <p className="text-xs text-[#9E8F7E] mb-4">
        {activeRecipes.length} {activeRecipes.length === 1 ? 'cocktail' : 'cocktails'}
        {isEventMenu ? ' on tonight\'s event menu' : ' · crafted in Oshkosh'}
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
          <section key={section}>
            <div className="flex items-center gap-3 mb-3">
              <p className="text-xs font-bold text-[#96321F] uppercase tracking-[0.18em]">{section}</p>
              <div className="flex-1 h-px bg-[#D4CFC3]" />
            </div>

            <div className="space-y-2">
              {sections[section].map(r => (
                <div key={r.id} className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-4">
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
