'use client'

import { useState } from 'react'
import type { LeaderboardPeriod } from '@/lib/supabase/types'

interface Props {
  period:      LeaderboardPeriod
  members:     { id: string; display_name: string | null }[]
  staffId:     string
  eventTypeId: string
}

interface TeamRow {
  name:      string
  score:     number
  memberIds: string[]
}

export default function TriviaTeamForm({ period, members, staffId, eventTypeId }: Props) {
  const [teams, setTeams]     = useState<TeamRow[]>([{ name: '', score: 0, memberIds: [] }])
  const [saving, setSaving]   = useState(false)
  const [message, setMessage] = useState('')

  function addTeam()  { setTeams(t => [...t, { name: '', score: 0, memberIds: [] }]) }
  function removeTeam(i: number) { setTeams(t => t.filter((_, j) => j !== i)) }
  function updateTeam(i: number, field: keyof TeamRow, value: any) {
    setTeams(t => t.map((team, j) => j === i ? { ...team, [field]: value } : team))
  }
  function toggleMember(teamIdx: number, memberId: string) {
    setTeams(t => t.map((team, j) => {
      if (j !== teamIdx) return team
      const ids = team.memberIds.includes(memberId)
        ? team.memberIds.filter(id => id !== memberId)
        : [...team.memberIds, memberId]
      return { ...team, memberIds: ids }
    }))
  }

  async function submitTeams() {
    const valid = teams.filter(t => t.name && t.score >= 0 && t.memberIds.length > 0)
    if (valid.length === 0) return
    setSaving(true)
    setMessage('')

    // Sort by score descending to auto-assign placement
    const sorted = [...valid].sort((a, b) => b.score - a.score)

    const res = await fetch('/api/staff/leaderboard-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        periodId: period.id,
        scoringMethod: 'placement',
        staffId,
        teams: sorted.map((t, i) => ({
          name:      t.name,
          score:     t.score,
          placement: i + 1,
          memberIds: t.memberIds,
        })),
      }),
    })

    const json = await res.json()
    if (res.ok) {
      setMessage(`Saved ${valid.length} teams ✓`)
      setTeams([{ name: '', score: 0, memberIds: [] }])
    } else {
      setMessage(json.error ?? 'Error saving teams')
    }
    setSaving(false)
  }

  const allUsed = teams.flatMap(t => t.memberIds)

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">Add each team, their score, and members</p>

      {teams.map((team, i) => (
        <div key={i} className="bg-[#0f0f0f] border border-[#2e2e2e] rounded-xl p-3 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={team.name}
              onChange={e => updateTeam(i, 'name', e.target.value)}
              placeholder={`Team ${i + 1} name`}
              className="flex-1 bg-[#1a1a1a] border border-[#2e2e2e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#b06aff]"
            />
            <input
              type="number"
              min={0}
              value={team.score}
              onChange={e => updateTeam(i, 'score', parseInt(e.target.value) || 0)}
              placeholder="score"
              className="w-20 bg-[#1a1a1a] border border-[#2e2e2e] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#b06aff] text-center"
            />
            {teams.length > 1 && (
              <button onClick={() => removeTeam(i)} className="text-gray-600 hover:text-red-400 px-2">×</button>
            )}
          </div>

          {/* Member picker */}
          <div className="flex flex-wrap gap-1.5">
            {members.map(m => {
              const isOnThisTeam = team.memberIds.includes(m.id)
              const isOnOtherTeam = !isOnThisTeam && allUsed.includes(m.id)
              return (
                <button
                  key={m.id}
                  onClick={() => toggleMember(i, m.id)}
                  disabled={isOnOtherTeam}
                  className={`text-xs px-2.5 py-1 rounded-full transition-all ${
                    isOnThisTeam
                      ? 'bg-[#b06aff] text-white'
                      : isOnOtherTeam
                        ? 'bg-[#1a1a1a] text-gray-600 cursor-not-allowed'
                        : 'bg-[#1a1a1a] text-gray-400 hover:bg-[#2e2e2e]'
                  }`}
                >
                  {m.display_name}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <button onClick={addTeam} className="text-xs text-[#b06aff] hover:text-[#c07aff] transition-colors">
        + Add team
      </button>

      <button
        onClick={submitTeams}
        disabled={saving || teams.every(t => !t.name || t.memberIds.length === 0)}
        className="w-full bg-[#b06aff] text-white font-semibold py-2.5 rounded-xl disabled:opacity-40 text-sm"
      >
        {saving ? 'Saving…' : 'Submit Results'}
      </button>

      {message && <p className="text-sm text-[#5dbb5d]">{message}</p>}
    </div>
  )
}
