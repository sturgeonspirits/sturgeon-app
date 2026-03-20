'use client'

import { useState } from 'react'
import type { LeaderboardPeriod } from '@/lib/supabase/types'

interface Props {
  period:  LeaderboardPeriod
  members: { id: string; display_name: string | null }[]
  staffId: string
}

interface ScoreRow { userId: string; score: string }

export default function TriviaIndividualForm({ period, members, staffId }: Props) {
  const [rows,    setRows]    = useState<ScoreRow[]>([{ userId: '', score: '' }])
  const [saving,  setSaving]  = useState(false)
  const [message, setMessage] = useState('')

  function addRow()    { setRows(r => [...r, { userId: '', score: '' }]) }
  function removeRow(i: number) { setRows(r => r.filter((_, j) => j !== i)) }
  function updateRow(i: number, field: keyof ScoreRow, value: string) {
    setRows(r => r.map((row, j) => j === i ? { ...row, [field]: value } : row))
  }

  async function submitScores() {
    const valid = rows.filter(r => r.userId && r.score !== '')
    if (valid.length === 0) return
    setSaving(true)
    setMessage('')

    const res = await fetch('/api/staff/leaderboard-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        periodId:      period.id,
        scoringMethod: 'points',
        staffId,
        entries: valid.map(r => ({ userId: r.userId, score: parseInt(r.score) || 0 })),
      }),
    })

    const json = await res.json()
    if (res.ok) {
      setMessage(`${valid.length} score${valid.length > 1 ? 's' : ''} saved!`)
      setRows([{ userId: '', score: '' }])
      setTimeout(() => setMessage(''), 3000)
    } else {
      setMessage(json.error ?? 'Error saving scores')
    }
    setSaving(false)
  }

  const usedIds = rows.map(r => r.userId).filter(Boolean)

  return (
    <div className="space-y-3">
      <p className="text-xs text-[#7a6e5f]">Enter each player's total score for the night</p>

      {rows.map((row, i) => (
        <div key={i} className="flex gap-2 items-center">
          <select
            value={row.userId}
            onChange={e => updateRow(i, 'userId', e.target.value)}
            className="flex-1 bg-[#161410] border border-[#2c2820] rounded-lg px-3 min-h-[44px] text-[#F1F1E7] text-base focus:outline-none focus:border-[#96321F]/60"
          >
            <option value="">Select player</option>
            {members.map(m => (
              <option key={m.id} value={m.id}
                disabled={usedIds.includes(m.id) && m.id !== row.userId}>
                {m.display_name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            value={row.score}
            onChange={e => updateRow(i, 'score', e.target.value)}
            className="w-24 bg-[#161410] border border-[#2c2820] rounded-lg px-3 min-h-[44px] text-[#F1F1E7] text-base focus:outline-none focus:border-[#96321F]/60 text-center"
            placeholder="score"
          />
          {rows.length > 1 && (
            <button onClick={() => removeRow(i)} className="text-[#3a3228] hover:text-red-400 text-xl px-1 leading-none">×</button>
          )}
        </div>
      ))}

      <button onClick={addRow} className="text-xs text-[#96321F]/70 hover:text-[#96321F] transition-colors">
        + Add player
      </button>

      <button
        onClick={submitScores}
        disabled={saving || rows.every(r => !r.userId)}
        className="w-full bg-[#96321F] text-[#F1F1E7] font-semibold py-3.5 rounded-xl disabled:opacity-40 hover:bg-[#ae3a24] active:scale-[0.98] transition-all text-base"
      >
        {saving ? 'Saving…' : 'Submit Scores'}
      </button>

      {message && (
        <p className={`text-sm ${message.includes('!') ? 'text-[#87A67F]' : 'text-red-400'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
