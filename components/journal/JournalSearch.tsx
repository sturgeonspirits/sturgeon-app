'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import DeleteEntryButton from '@/components/journal/DeleteEntryButton'
import { relativeTime } from '@/lib/utils'
import { Search } from '@/components/icons/brand'

interface Entry {
  id: string
  spirit_name: string | null
  spirit_category: string | null
  overall_notes: string | null
  rating: number | null
  visited_at: string | null
}

interface Props {
  entries: Entry[]
}

export default function JournalSearch({ entries }: Props) {
  const [query, setQuery] = useState('')

  // Collect unique categories for filter chips
  const allCategories = useMemo(() => {
    const set = new Set<string>()
    for (const e of entries) {
      if (e.spirit_category) set.add(e.spirit_category)
    }
    return Array.from(set).sort()
  }, [entries])

  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries.filter(e => {
      const matchesText = !q
        || (e.spirit_name ?? '').toLowerCase().includes(q)
        || (e.spirit_category ?? '').toLowerCase().includes(q)
        || (e.overall_notes ?? '').toLowerCase().includes(q)
      const matchesCategory = !activeCategory || e.spirit_category === activeCategory
      return matchesText && matchesCategory
    })
  }, [entries, query, activeCategory])

  const isFiltering = query.trim() !== '' || activeCategory !== null

  function clearFilters() {
    setQuery('')
    setActiveCategory(null)
  }

  return (
    <>
      {/* ── Search bar ────────────────────────────────── */}
      <div className="relative mb-3">
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
          placeholder="Search by cocktail, category, or notes…"
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

      {/* ── Category chips ────────────────────────────── */}
      {allCategories.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {allCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={`text-[11px] font-medium px-3 py-1 rounded-full border capitalize transition-colors ${
                activeCategory === cat
                  ? 'bg-[#96321F] border-[#96321F] text-[#FFFFFF]'
                  : 'bg-[#FFFFFF] border-[#D4CFC3] text-[#7E613F] hover:border-[#96321F] hover:text-[#96321F]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* ── Results count / clear ─────────────────────── */}
      {isFiltering && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-[#9E8F7E]">
            {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'} found
          </p>
          <button
            onClick={clearFilters}
            className="text-xs text-[#96321F] font-semibold hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* ── No results ───────────────────────────────── */}
      {filtered.length === 0 && (
        <div className="text-center py-14 bg-[#FFFFFF] rounded-xl border border-[#D4CFC3]">
          <Search size={40} className="text-[#D4CFC3] mx-auto mb-3" />
          <p className="font-semibold text-[#242622] mb-1">No entries found</p>
          <p className="text-sm text-[#7E613F]">Try different keywords or clear your filters</p>
          <button
            onClick={clearFilters}
            className="mt-4 text-sm text-[#96321F] font-semibold hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* ── Entry list ───────────────────────────────── */}
      <div className="space-y-3">
        {filtered.map(log => (
          <div key={log.id} className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <p className="font-semibold text-[#242622]">
                  <HighlightMatch text={log.spirit_name ?? 'Unknown'} query={query} />
                </p>
                <p className="text-xs text-[#7E613F] mt-0.5 capitalize">
                  <HighlightMatch text={log.spirit_category ?? ''} query={query} />
                </p>
              </div>
              <div className="flex items-center gap-3 ml-3 shrink-0">
                {log.rating && (
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <span key={i} className={i < log.rating! ? 'text-[#96321F]' : 'text-[#D4CFC3]'}>★</span>
                    ))}
                  </div>
                )}
                <Link
                  href={`/journal/${log.id}/edit`}
                  className="text-xs text-[#7E613F] hover:text-[#96321F] font-medium transition-colors"
                >
                  Edit
                </Link>
                <DeleteEntryButton logId={log.id} />
              </div>
            </div>
            {log.overall_notes && (
              <p className="text-sm text-[#7E613F] leading-relaxed line-clamp-2">
                <HighlightMatch text={log.overall_notes} query={query} />
              </p>
            )}
            <p className="text-xs text-[#9E8F7E] mt-2">{relativeTime(log.visited_at ?? '')}</p>
          </div>
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
