'use client'

import { useState } from 'react'
import type { LeaderboardPeriod } from '@/lib/supabase/types'

interface Props {
  period:  LeaderboardPeriod
  members: { id: string; display_name: string | null }[]
  staffId: string
}

interface MatchResult {
  winnerId: string
  loserId:  string
}

export default function CribbageScoreForm({ period, members, staffId }: Props) {
  const [winner, setWinner]   = useState('')
  const [loser, setLoser]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [message, setMessage] = useState('')
  const [results, setResults] = useState<MatchResult[]>([])

  async function submitMatch() {
    if (!winner || !loser || winner === loser) return
    setSaving(true)
    setMessage('')

    const res = await fetch('/api/staff/leaderboard-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        periodId:    period.id,
        scoringMethod: 'wins_losses',
        staffId,
        entries: [
          { userId: winner, wins: 1, losses: 0 },
          { userId: loser,  wins: 0, losses: 1 },
        ],
      }),
    })

    const json = await res.json()
    if (res.ok) {
      setResults(prev => [...prev, { winnerId: winner, loserId: loser }])
      setWinner('')
      setLoser('')
      setMessage('Match recorded ✓')
    } else {
      setMessage(json.error ?? 'Error saving match')
    }
    setSaving(false)
  }

  const memberName = (id: string) => members.find(m => m.id === id)?.display_name ?? id

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">Record each cribbage match individually</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Winner 🏆</label>
          <select
            value={winner}
            onChange={e => setWinner(e.target.value)}
            className="w-full bg-[#0f0f0f] border border-[#2e2e2e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f5c842]"
          >
            <option value="">Select player</option>
            {members.map(m => (
              <option key={m.id} value={m.id} disabled={m.id === loser}>
                {m.display_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Loser</label>
          <select
            value={loser}
            onChange={e => setLoser(e.target.value)}
            className="w-full bg-[#0f0f0f] border border-[#2e2e2e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#f5c842]"
          >
            <option value="">Select player</option>
            {members.map(m => (
              <option key={m.id} value={m.id} disabled={m.id === winner}>
                {m.display_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={submitMatch}
        disabled={!winner || !loser || winner === loser || saving}
        className="w-full bg-[#e87c3e] text-white font-semibold py-2.5 rounded-xl disabled:opacity-40 hover:bg-[#e88c4e] transition-colors text-sm"
      >
        {saving ? 'Saving…' : 'Record Match'}
      </button>

      {message && <p className="text-sm text-[#5dbb5d]">{message}</p>}

      {results.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-gray-500 uppercase tracking-wide">This session:</p>
          {results.map((r, i) => (
            <p key={i} className="text-xs text-gray-400">
              🏆 {memberName(r.winnerId)} def. {memberName(r.loserId)}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
