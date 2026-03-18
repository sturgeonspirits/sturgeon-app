'use client'

import { useState } from 'react'
import type { LeaderboardPeriod } from '@/lib/supabase/types'

interface Props {
  period:  LeaderboardPeriod
  members: { id: string; display_name: string | null }[]
  staffId: string
}

interface ScoreRow { userId: string; score: number }

export default function TriviaIndividualForm({ period, members, staffId }: Props) {
  const [rows, setRows]       = useState<ScoreRow[]>([{ userId: '', score: 0 }])
  const [saving, setSaving]   = useState(false)
  const [message, setMessage] = useState('')

  function addRow()  { setRows(r => [...r, { userId: '', score: 0 }]) }
  function removeRow(i: number) { setRows(r => r.filter((_, j) => j !== i)) }
  function updateRow(i: number, field: keyof ScoreRow, value: string | number) {
    setRows(r => r.map((row, j) => j === i ? { ...row, [field]: value } : row))
  }

  async function submitScores() {
    const valid = rows.filter(r => r.userId && r.score > 0)
    if (valid.length === 0) return
    setSaving(true)
    setMessage('')

    const res = await fetch('/api/staff/leaderboard-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        periodId: period.id,
        scoringMethod: 'points',
        staffId,
        entries: valid.map(r => ({ userId: r.userId, score: r.score })),
      }),
    })

    const json = await res.json()
    if (res.ok) {
      setMessage(`Saved ${valid.length} scores ✓`)
      setRows([{ userId: '', score: 0 }])
    } else {
      setMessage(json.error ?? 'Error saving scores')
    }
    setSaving(false)
  }

  const usedIds = rows.map(r => r.userId).filter(Boolean)

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Enter each participant's final score</p>

      {rows.map((row, i) => (
        <div key={i} className="flex gap-2 items-center">
          <select
            value={row.userId}
            onChange={e => updateRow(i, 'userId', e.target.value)}
            className="flex-1 bg-[#0f0f0f] border border-[#2e2e2e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#5aadff]"
          >
            <option value="">Select player</option>
            {members.map(m => (
              <option key={m.id} value={m.id} disabled={usedIds.includes(m.id) && m.id !== row.userId}>
                {m.display_name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            value={row.score}
            onChange={e => updateRow(i, 'score', parseInt(e.target.value) || 0)}
            className="w-20 bg-[#0f0f0f] border border-[#2e2e2e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#5aadff] text-center"
            placeholder="pts"
          />
          {rows.length > 1 && (
            <button onClick={() => removeRow(i)} className="text-gray-600 hover:text-red-400 text-lg px-1">×</button>
          )}
        </div>
      ))}

      <button onClick={addRow} className="text-xs text-[#5aadff] hover:text-[#7abdff] transition-colors">
        + Add player
      </button>

      <button
        onClick={submitScores}
        disabled={saving || rows.every(r => !r.userId)}
        className="w-full bg-[#5aadff] text-black font-semibold py-2.5 rounded-xl disabled:opacity-40 text-sm"
      >
        {saving ? 'Saving…' : 'Submit Scores'}
      </button>

      {message && <p className="text-sm text-[#5dbb5d]">{message}</p>}
    </div>
  )
}
