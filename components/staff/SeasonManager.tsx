'use client'

import { useState, useEffect } from 'react'

interface Season {
  id: string
  label: string
  starts_at: string
  created_at: string
}

interface Props {
  eventTypes: { id: string; name: string; icon: string }[]
}

export default function SeasonManager({ eventTypes }: Props) {
  const [seasons,  setSeasons]  = useState<Record<string, Season | null>>({})
  const [loading,  setLoading]  = useState(true)
  const [creating, setCreating] = useState<string | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [saving,   setSaving]   = useState(false)
  const [message,  setMessage]  = useState('')

  useEffect(() => {
    async function load() {
      const results: Record<string, Season | null> = {}
      await Promise.all(
        eventTypes.map(async et => {
          const res = await fetch(`/api/staff/season?eventTypeId=${et.id}`)
          const json = await res.json()
          results[et.id] = json.season ?? null
        })
      )
      setSeasons(results)
      setLoading(false)
    }
    load()
  }, [eventTypes])

  async function startNewSeason(eventTypeId: string) {
    setSaving(true)
    setMessage('')
    const label = newLabel.trim() || `Season ${new Date().getFullYear()}`
    const res = await fetch('/api/staff/season', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventTypeId, label }),
    })
    const json = await res.json()
    if (res.ok) {
      setSeasons(s => ({ ...s, [eventTypeId]: json.season }))
      setMessage(`New season "${json.season.label}" started ✓`)
      setCreating(null)
      setNewLabel('')
      setTimeout(() => setMessage(''), 3000)
    } else {
      setMessage(json.error ?? 'Failed to start season')
    }
    setSaving(false)
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    })
  }

  if (loading) return null

  return (
    <div className="bg-[#F7F5EF] border border-[#D4CFC3] rounded-xl p-4 space-y-3">
      <p className="text-xs font-bold text-[#7E613F] uppercase tracking-widest">Season</p>
      <p className="text-xs text-[#9E8F7E]">
        Running standings only count events within the current season. Start a new season to reset standings.
      </p>

      {eventTypes.map(et => {
        const season = seasons[et.id]
        const isCreating = creating === et.id
        return (
          <div key={et.id} className="bg-white border border-[#E8E4DB] rounded-xl px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{et.icon}</span>
              <span className="text-sm font-semibold text-[#242622] flex-1">{et.name}</span>
              {season ? (
                <span className="text-xs text-[#87A67F] font-medium bg-[#87A67F]/10 px-2 py-0.5 rounded-full">
                  {season.label}
                </span>
              ) : (
                <span className="text-xs text-[#9E8F7E]">No season set</span>
              )}
            </div>

            {season && (
              <p className="text-xs text-[#9E8F7E]">
                Started {fmtDate(season.starts_at)} — standings count from this date
              </p>
            )}

            {!isCreating ? (
              <button
                onClick={() => { setCreating(et.id); setNewLabel(`Season ${new Date().getFullYear()}`) }}
                className="text-xs text-[#96321F] font-semibold hover:underline"
              >
                {season ? 'Start new season (reset standings)' : 'Start first season'}
              </button>
            ) : (
              <div className="space-y-2 pt-1">
                <input
                  type="text"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  placeholder="Season 2026"
                  className="w-full border border-[#C8BCA4] rounded-lg px-3 py-2 text-sm text-[#242622] focus:outline-none focus:border-[#96321F]"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => startNewSeason(et.id)}
                    disabled={saving}
                    className="flex-1 bg-[#96321F] text-white text-sm font-semibold py-2 rounded-lg disabled:opacity-40 hover:bg-[#ae3a24] transition-colors"
                  >
                    {saving ? 'Starting…' : 'Start season'}
                  </button>
                  <button
                    onClick={() => { setCreating(null); setNewLabel('') }}
                    className="px-4 py-2 text-sm text-[#7E613F] border border-[#D4CFC3] rounded-lg hover:bg-[#F5F2EC] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {message && (
        <p className={`text-xs font-medium ${message.includes('✓') ? 'text-[#87A67F]' : 'text-red-500'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
