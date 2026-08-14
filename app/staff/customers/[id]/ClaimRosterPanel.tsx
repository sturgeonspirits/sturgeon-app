'use client'
// ─────────────────────────────────────────────
// Changelog
//   v2026-08-14.1 — New: link a roster member to a real signed-up account.
//                   Two-step (search → confirm) because the merge can't be undone.
// ─────────────────────────────────────────────
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Candidate {
  id: string
  display_name: string | null
  email: string | null
}

export default function ClaimRosterPanel({
  rosterId, rosterName,
}: {
  rosterId: string
  rosterName: string
}) {
  const router = useRouter()

  const [q,        setQ]        = useState('')
  const [results,  setResults]  = useState<Candidate[] | null>(null)
  const [chosen,   setChosen]   = useState<Candidate | null>(null)
  const [searching, setSearching] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [error,    setError]    = useState('')
  const [done,     setDone]     = useState(false)

  async function search(e: React.FormEvent) {
    e.preventDefault()
    if (!q.trim()) return
    setSearching(true)
    setError('')
    try {
      const res  = await fetch(`/api/staff/customer-search?q=${encodeURIComponent(q.trim())}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Search failed')
      // A roster member can't be claimed into another roster member, and
      // claiming into itself is rejected server-side anyway.
      setResults((json.customers ?? []).filter((c: Candidate) => c.id !== rosterId && c.email))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSearching(false)
    }
  }

  async function claim() {
    if (!chosen) return
    setClaiming(true)
    setError('')
    try {
      const res = await fetch('/api/staff/roster/claim', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rosterId, targetId: chosen.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not link the account')
      setDone(true)
      setTimeout(() => router.push(`/staff/customers/${chosen.id}`), 1200)
    } catch (err: any) {
      setError(err.message)
      setClaiming(false)
    }
  }

  if (done) {
    return (
      <div className="bg-[#87A67F]/10 border border-[#87A67F]/30 rounded-xl px-4 py-3">
        <p className="text-sm text-[#5a7a54] font-semibold">
          ✓ {rosterName}&rsquo;s history moved to {chosen?.display_name ?? chosen?.email}. Opening their profile…
        </p>
      </div>
    )
  }

  return (
    <div className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl p-4 space-y-3">
      <p className="text-sm text-[#7E613F]">
        When {rosterName} signs up with a real email, link the two here. Their cribbage
        record and every night they played move to the real account, and this roster
        entry is retired. <strong>This can&rsquo;t be undone.</strong>
      </p>

      <form onSubmit={search} className="flex gap-2">
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setChosen(null) }}
          placeholder="Search their new account by name or email…"
          className="flex-1 border border-[#D4CFC3] rounded-xl px-3 py-2.5 text-sm text-[#242622] bg-[#FFFFFF] focus:outline-none focus:border-[#96321F] transition-colors"
        />
        <button
          type="submit"
          disabled={searching || !q.trim()}
          className="px-4 py-2.5 rounded-xl bg-[#EDE9DC] text-[#7E613F] font-semibold text-sm hover:bg-[#D4CFC3] disabled:opacity-50 transition-colors"
        >
          {searching ? '…' : 'Search'}
        </button>
      </form>

      {results && results.length === 0 && (
        <p className="text-xs text-[#9E8F7E]">
          No signed-up accounts matched. They need to have signed in at least once first.
        </p>
      )}

      {results && results.length > 0 && (
        <div className="space-y-1">
          {results.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => setChosen(c)}
              className={`w-full text-left border rounded-lg px-3 py-2 transition-colors ${
                chosen?.id === c.id
                  ? 'border-[#96321F] bg-[#96321F]/5'
                  : 'border-[#E8E4DB] bg-white hover:border-[#96321F]/40'
              }`}
            >
              <p className="text-sm font-semibold text-[#242622]">{c.display_name ?? 'Unnamed'}</p>
              <p className="text-xs text-[#9E8F7E]">{c.email}</p>
            </button>
          ))}
        </div>
      )}

      {chosen && (
        <div className="border-t border-[#EDE9DC] pt-3 space-y-2">
          <p className="text-sm text-[#242622]">
            Move <strong>{rosterName}</strong>&rsquo;s history to{' '}
            <strong>{chosen.display_name ?? chosen.email}</strong>?
          </p>
          <button
            type="button"
            onClick={claim}
            disabled={claiming}
            className="w-full bg-[#96321F] text-[#FFFFFF] font-bold py-2.5 rounded-xl hover:bg-[#ae3a24] disabled:opacity-50 transition-colors text-sm"
          >
            {claiming ? 'Linking…' : 'Link accounts'}
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
      )}
    </div>
  )
}
