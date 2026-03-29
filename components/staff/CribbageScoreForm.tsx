'use client'

import { useState } from 'react'
import type { LeaderboardPeriod } from '@/lib/supabase/types'

interface Props {
  period:  LeaderboardPeriod
  members: { id: string; display_name: string | null; full_name: string | null; phone: string | null; email: string | null }[]
  staffId: string
}

type MemberOption = { id: string; display_name: string | null; full_name: string | null; phone: string | null; email: string | null }
function memberLabel(m: MemberOption) {
  const name = m.full_name ?? m.display_name ?? m.email ?? '?'
  return m.phone ? `${name} · ${m.phone}` : name
}

interface PlayerRow {
  userId: string
  wins:   string   // '0'|'1'|'2'|'3'
  spread: string   // total point spread, can be negative
}

export default function CribbageScoreForm({ period, members, staffId }: Props) {
  const [rows,    setRows]    = useState<PlayerRow[]>([{ userId: '', wins: '', spread: '' }])
  const [saving,  setSaving]  = useState(false)
  const [message, setMessage] = useState('')

  function addRow() { setRows(r => [...r, { userId: '', wins: '', spread: '' }]) }
  function removeRow(i: number) { setRows(r => r.filter((_, j) => j !== i)) }
  function updateRow(i: number, field: keyof PlayerRow, value: string) {
    setRows(r => r.map((row, j) => j === i ? { ...row, [field]: value } : row))
  }

  async function submitScores() {
    const valid = rows.filter(r => r.userId && r.wins !== '')
    if (valid.length === 0) return
    setSaving(true)
    setMessage('')

    const entries = valid.map(r => {
      const wins   = parseInt(r.wins)   || 0
      const spread = parseInt(r.spread) || 0
      return { userId: r.userId, wins, losses: 3 - wins, spread }
    })

    const res = await fetch('/api/staff/leaderboard-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        periodId:      period.id,
        scoringMethod: 'wins_losses',
        staffId,
        entries,
      }),
    })

    let json: any = {}
    try { json = await res.json() } catch { /* non-JSON response (e.g. gateway error) */ }
    if (res.ok) {
      setMessage(`${valid.length} player${valid.length > 1 ? 's' : ''} saved!`)
      setRows([{ userId: '', wins: '', spread: '' }])
      setTimeout(() => setMessage(''), 3000)
    } else {
      setMessage(json.error ?? 'Server error — please try again')
    }
    setSaving(false)
  }

  const usedIds = rows.map(r => r.userId).filter(Boolean)

  return (
    <div className="space-y-3">
      <p className="text-xs text-[#7a6e5f]">
        Each player plays 3 matches — enter their wins and total point spread for the night
      </p>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_80px_96px_24px] gap-2 px-1">
        <span className="text-xs text-[#7E613F] uppercase tracking-wide">Player</span>
        <span className="text-xs text-[#7E613F] uppercase tracking-wide text-center">Wins</span>
        <span className="text-xs text-[#7E613F] uppercase tracking-wide text-center">Spread</span>
        <span />
      </div>

      {rows.map((row, i) => {
        const winsNum = parseInt(row.wins)
        return (
          <div key={i} className="grid grid-cols-[1fr_80px_96px_24px] gap-2 items-center">
            {/* Player */}
            <select
              value={row.userId}
              onChange={e => updateRow(i, 'userId', e.target.value)}
              className="bg-[#FFFFFF] border border-[#C8BCA4] rounded-lg px-3 min-h-[44px] text-[#242622] text-base focus:outline-none focus:border-[#96321F]"
            >
              <option value="">Player</option>
              {members.map(m => (
                <option key={m.id} value={m.id}
                  disabled={usedIds.includes(m.id) && m.id !== row.userId}>
                  {memberLabel(m)}
                </option>
              ))}
            </select>

            {/* Wins: tap 0–3 — min 44px tall for thumb taps */}
            <div className="flex gap-1">
              {[0, 1, 2, 3].map(n => (
                <button
                  key={n}
                  onClick={() => updateRow(i, 'wins', String(n))}
                  className={`flex-1 min-h-[44px] rounded-lg text-sm font-bold border transition-all active:scale-95 ${
                    row.wins === String(n)
                      ? 'bg-[#96321F] text-[#FFFFFF] border-[#96321F]'
                      : 'bg-[#FFFFFF] text-[#7E613F] border-[#D4CFC3] hover:border-[#96321F]/50'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            {/* Point spread (+ or –) */}
            <input
              type="number"
              value={row.spread}
              onChange={e => updateRow(i, 'spread', e.target.value)}
              placeholder="±0"
              className="bg-[#FFFFFF] border border-[#C8BCA4] rounded-lg px-2 min-h-[44px] text-[#242622] text-base focus:outline-none focus:border-[#96321F] text-center"
            />

            {rows.length > 1 && (
              <button onClick={() => removeRow(i)} className="text-[#9E8F7E] hover:text-red-500 text-xl leading-none">×</button>
            )}
          </div>
        )
      })}

      <button onClick={addRow} className="text-xs text-[#96321F]/70 hover:text-[#96321F] transition-colors">
        + Add player
      </button>

      <button
        onClick={submitScores}
        disabled={saving || rows.every(r => !r.userId || r.wins === '')}
        className="w-full bg-[#96321F] text-[#FFFFFF] font-semibold py-3.5 rounded-xl disabled:opacity-40 hover:bg-[#ae3a24] active:scale-[0.98] transition-all text-base"
      >
        {saving ? 'Saving…' : 'Submit Scores'}
      </button>

      {message && (
        <p className={`text-sm ${message.includes('!') ? 'text-[#5dbb5d]' : 'text-red-500'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
