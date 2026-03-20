'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Spirit } from '@/lib/supabase/types'

interface Props {
  spirits: Pick<Spirit, 'id' | 'name' | 'category' | 'subcategory' | 'is_house'>[]
  userId:  string
}

export default function JournalForm({ spirits, userId }: Props) {
  const router   = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const [spiritId,       setSpiritId]       = useState('')
  const [customName,     setCustomName]      = useState('')
  const [customCategory, setCustomCategory]  = useState('whiskey')
  const [nose,           setNose]            = useState('')
  const [palate,         setPalate]          = useState('')
  const [finish,         setFinish]          = useState('')
  const [notes,          setNotes]           = useState('')
  const [rating,         setRating]          = useState(0)

  const CATEGORIES = ['whiskey','gin','vodka','rum','brandy','liqueur','beer','wine','cocktail','other']

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/journal-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          spiritId:       spiritId || null,
          spiritName:     spiritId ? null : customName,
          spiritCategory: spiritId ? null : customCategory,
          nose,
          palate,
          finish,
          overallNotes: notes,
          rating: rating || null,
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

  const inputClass = "w-full bg-[#FFFFFF] border border-[#C8BCA4] rounded-xl px-4 py-3 text-[#242622] placeholder-[#9E8F7E] focus:outline-none focus:border-[#96321F] transition-colors text-sm"
  const textareaClass = `${inputClass} resize-none`
  const labelClass = "block text-xs font-medium text-[#7E613F] mb-1.5 uppercase tracking-widest"

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pb-10">
      {/* Spirit selection — grouped from menu */}
      <div>
        <label className={labelClass}>What are you tasting?</label>
        <select
          value={spiritId}
          onChange={e => setSpiritId(e.target.value)}
          className={inputClass}
        >
          <option value="">— Not on the menu —</option>
          {/* House spirits first */}
          {spirits.filter(s => s.is_house).length > 0 && (
            <optgroup label="🏠 Sturgeon Spirits">
              {spirits.filter(s => s.is_house).map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.subcategory ? ` · ${s.subcategory}` : ''}
                </option>
              ))}
            </optgroup>
          )}
          {/* Other menu items grouped by category */}
          {Array.from(new Set(spirits.filter(s => !s.is_house).map(s => s.category)))
            .sort()
            .map(cat => (
              <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
                {spirits.filter(s => !s.is_house && s.category === cat).map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.subcategory ? ` · ${s.subcategory}` : ''}
                  </option>
                ))}
              </optgroup>
            ))
          }
        </select>
      </div>

      {/* Custom spirit if not in catalogue */}
      {!spiritId && (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelClass}>Spirit name</label>
            <input
              type="text"
              required
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              placeholder="e.g. Ardbeg 10"
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
        disabled={loading || (!spiritId && !customName)}
        className="w-full bg-[#96321F] text-[#FFFFFF] font-bold py-4 rounded-xl disabled:opacity-40 hover:bg-[#ae3a24] transition-colors"
      >
        {loading ? 'Saving…' : 'Save Entry'}
      </button>
    </form>
  )
}
