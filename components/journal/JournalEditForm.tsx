'use client'

import { useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface Recipe {
  id:           string
  name:         string
  menu_section: string | null
  flavor_tags:  string[] | null
}

interface Entry {
  id:              string
  spirit_name:     string | null
  spirit_category: string | null
  nose:            string | null
  palate:          string | null
  finish:          string | null
  overall_notes:   string | null
  rating:          number | null
}

interface Props {
  entry:   Entry
  recipes: Recipe[]
  userId:  string
}

export default function JournalEditForm({ entry, recipes, userId }: Props) {
  const router  = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  // Try to find a matching recipe by name for pre-selection
  const initialRecipe = recipes.find(r => r.name === entry.spirit_name) ?? null

  // Cocktail search state
  const [query,          setQuery]          = useState('')
  const [showDropdown,   setShowDropdown]   = useState(false)
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(initialRecipe)
  const inputRef = useRef<HTMLInputElement>(null)

  // Custom entry fields — pre-populated for non-menu items
  const [customName,     setCustomName]     = useState(initialRecipe ? '' : (entry.spirit_name ?? ''))
  const [customCategory, setCustomCategory] = useState(entry.spirit_category ?? 'cocktail')

  // Tasting notes — pre-populated
  const [nose,   setNose]   = useState(entry.nose          ?? '')
  const [palate, setPalate] = useState(entry.palate        ?? '')
  const [finish, setFinish] = useState(entry.finish        ?? '')
  const [notes,  setNotes]  = useState(entry.overall_notes ?? '')
  const [rating, setRating] = useState(entry.rating        ?? 0)

  const CATEGORIES = ['whiskey','gin','vodka','rum','brandy','liqueur','beer','wine','cocktail','other']

  const submitName     = selectedRecipe ? selectedRecipe.name : customName
  const submitCategory = selectedRecipe ? (selectedRecipe.menu_section ?? 'cocktail') : customCategory

  const filteredRecipes = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return recipes.slice(0, 10)
    return recipes.filter(r => r.name.toLowerCase().includes(q)).slice(0, 10)
  }, [recipes, query])

  function selectRecipe(r: Recipe) {
    setSelectedRecipe(r)
    setQuery('')
    setShowDropdown(false)
  }

  function clearRecipe() {
    setSelectedRecipe(null)
    setQuery('')
    setCustomName('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/journal-entry', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logId:          entry.id,
          spiritName:     submitName     || null,
          spiritCategory: submitCategory || null,
          nose:           nose   || null,
          palate:         palate || null,
          finish:         finish || null,
          overallNotes:   notes  || null,
          rating:         rating || null,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Something went wrong')

      router.push('/journal')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const inputClass    = "w-full bg-[#FFFFFF] border border-[#C8BCA4] rounded-xl px-4 py-3 text-[#242622] placeholder-[#9E8F7E] focus:outline-none focus:border-[#96321F] transition-colors text-sm"
  const textareaClass = `${inputClass} resize-none`
  const labelClass    = "block text-xs font-medium text-[#7E613F] mb-1.5 uppercase tracking-widest"

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pb-10">
      {/* Cocktail / spirit picker */}
      <div>
        <label className={labelClass}>What are you tasting?</label>

        {selectedRecipe ? (
          <div className="flex items-center gap-2 bg-[#EDE9DC] border border-[#C8BCA4] rounded-xl px-4 py-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#242622]">{selectedRecipe.name}</p>
              {selectedRecipe.menu_section && (
                <p className="text-xs text-[#7E613F] mt-0.5 capitalize">{selectedRecipe.menu_section}</p>
              )}
            </div>
            <button
              type="button"
              onClick={clearRecipe}
              className="text-[#7E613F] hover:text-[#96321F] transition-colors p-1"
              aria-label="Change cocktail"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setShowDropdown(true) }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              placeholder="Search cocktails or type a name…"
              className={inputClass}
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); setQuery('') }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C8BCA4] hover:text-[#7E613F] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
            {showDropdown && (
              <div className="absolute z-20 w-full mt-1 bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                {filteredRecipes.map(r => (
                  <button
                    type="button"
                    key={r.id}
                    onMouseDown={() => selectRecipe(r)}
                    className="w-full px-4 py-2.5 text-left hover:bg-[#F1F1E7] border-b border-[#F1F1E7] last:border-0 transition-colors"
                  >
                    <span className="text-sm font-medium text-[#242622]">{r.name}</span>
                    {r.menu_section && (
                      <span className="text-xs text-[#9E8F7E] ml-2 capitalize">{r.menu_section}</span>
                    )}
                  </button>
                ))}
                {query.trim() && filteredRecipes.length === 0 && (
                  <div className="px-4 py-3 text-sm text-[#9E8F7E] italic">
                    Not on the menu — fill in the name below
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom entry fields */}
      {!selectedRecipe && (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelClass}>Name</label>
            <input
              type="text"
              required
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              placeholder="e.g. Old Fashioned, Ardbeg 10…"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Category</label>
            <select value={customCategory} onChange={e => setCustomCategory(e.target.value)} className={inputClass}>
              {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Rating */}
      <div>
        <label className={labelClass}>Rating</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              type="button"
              key={n}
              onClick={() => setRating(rating === n ? 0 : n)}
              className="text-2xl transition-all hover:scale-110"
            >
              <span className={n <= rating ? 'text-[#96321F]' : 'text-[#D4CFC3]'}>★</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tasting notes */}
      <div>
        <label className={labelClass}>Nose</label>
        <textarea value={nose} onChange={e => setNose(e.target.value)} rows={2} placeholder="What do you smell?" className={textareaClass} />
      </div>
      <div>
        <label className={labelClass}>Palate</label>
        <textarea value={palate} onChange={e => setPalate(e.target.value)} rows={2} placeholder="What do you taste?" className={textareaClass} />
      </div>
      <div>
        <label className={labelClass}>Finish</label>
        <textarea value={finish} onChange={e => setFinish(e.target.value)} rows={2} placeholder="How does it linger?" className={textareaClass} />
      </div>
      <div>
        <label className={labelClass}>Overall notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Your thoughts…" className={textareaClass} />
      </div>

      {error && (
        <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || (!selectedRecipe && !customName)}
        className="w-full bg-[#96321F] text-[#FFFFFF] font-bold py-4 rounded-xl disabled:opacity-40 hover:bg-[#ae3a24] transition-colors"
      >
        {loading ? 'Saving…' : 'Save Changes'}
      </button>
    </form>
  )
}
