'use client'

import { useState } from 'react'

export default function ManualCheckinForm({ staffId }: { staffId: string }) {
  const [search,     setSearch]     = useState('')
  const [customers,  setCustomers]  = useState<{ id: string; display_name: string | null; email: string | null }[]>([])
  const [searching,  setSearching]  = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message,    setMessage]    = useState<{ text: string; ok: boolean } | null>(null)

  async function handleSearch() {
    if (!search.trim() || searching) return
    setSearching(true)
    setCustomers([])
    setMessage(null)
    try {
      const res  = await fetch(`/api/staff/customer-search?q=${encodeURIComponent(search.trim())}`)
      const json = await res.json()
      setCustomers(json.customers ?? [])
      if ((json.customers ?? []).length === 0) setMessage({ text: 'No customers found.', ok: false })
    } catch {
      setMessage({ text: 'Search failed — try again.', ok: false })
    } finally {
      setSearching(false)
    }
  }

  async function handleGrant(userId: string, displayName: string | null) {
    if (submitting) return
    setSubmitting(true)
    setMessage(null)
    try {
      const res  = await fetch('/api/staff/manual-checkin', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId }),
      })
      const json = await res.json()
      if (res.ok) {
        setMessage({ text: `✓ Granted ${json.pointsEarned} pts to ${displayName ?? 'member'}`, ok: true })
        setCustomers([])
        setSearch('')
      } else {
        setMessage({ text: json.error ?? 'Could not grant points', ok: false })
      }
    } catch {
      setMessage({ text: 'Request failed — try again.', ok: false })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Name or email…"
          className="flex-1 border border-[#D4CFC3] rounded-xl px-3 py-2.5 text-sm text-[#242622] focus:outline-none focus:border-[#96321F] transition-colors"
        />
        <button
          onClick={handleSearch}
          disabled={searching || !search.trim()}
          className="bg-[#242622] text-white text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-40 hover:bg-[#3a3b37] transition-colors"
        >
          {searching ? '…' : 'Find'}
        </button>
      </div>

      {/* Results */}
      {customers.length > 0 && (
        <div className="space-y-1.5">
          {customers.map(c => (
            <button
              key={c.id}
              onClick={() => handleGrant(c.id, c.display_name)}
              disabled={submitting}
              className="w-full bg-white border border-[#D4CFC3] rounded-xl px-4 py-3 text-left hover:border-[#96321F] transition-all disabled:opacity-50"
            >
              <p className="text-sm font-semibold text-[#242622]">{c.display_name ?? 'Unnamed'}</p>
              <p className="text-xs text-[#7E613F]">{c.email}</p>
              <p className="text-xs text-[#96321F] font-semibold mt-0.5">Grant +15 pts →</p>
            </button>
          ))}
        </div>
      )}

      {/* Feedback */}
      {message && (
        <p className={`text-xs px-3 py-2 rounded-xl ${message.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
