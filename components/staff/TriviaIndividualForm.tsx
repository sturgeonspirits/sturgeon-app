'use client'

import { useState, useRef, useMemo } from 'react'
import type { LeaderboardPeriod } from '@/lib/supabase/types'

type MemberOption = { id: string; display_name: string | null; full_name: string | null; phone: string | null; email: string | null }
function memberLabel(m: MemberOption) {
  const name = m.full_name ?? m.display_name ?? m.email ?? '?'
  return m.phone ? `${name} · ${m.phone}` : name
}

interface Props {
  period:  LeaderboardPeriod
  members: MemberOption[]
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

    let json: any = {}
    try { json = await res.json() } catch {}
    if (res.ok) {
      setMessage(`${valid.length} score${valid.length > 1 ? 's' : ''} saved!`)
      setRows([{ userId: '', score: '' }])
      setTimeout(() => setMessage(''), 3000)
    } else {
      setMessage(json.error ?? 'Server error — please try again')
    }
    setSaving(false)
  }

  const usedIds = rows.map(r => r.userId).filter(Boolean)

  const memberMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const mb of members) m[mb.id] = memberLabel(mb)
    return m
  }, [members])

  return (
    <div className="space-y-3">
      <p className="text-xs text-[#7E613F]">Enter each player's total score for the night</p>

      {rows.map((row, i) => (
        <div key={i} className="flex gap-2 items-center">
          <div className="flex-1">
            <PlayerSearch
              members={members}
              memberMap={memberMap}
              excludeIds={usedIds.filter(id => id !== row.userId)}
              selectedId={row.userId}
              onSelect={id => updateRow(i, 'userId', id)}
              onClear={() => updateRow(i, 'userId', '')}
            />
          </div>
          <input
            type="number"
            min={0}
            value={row.score}
            onChange={e => updateRow(i, 'score', e.target.value)}
            className="w-24 bg-[#FFFFFF] border border-[#C8BCA4] rounded-lg px-3 min-h-[44px] text-[#242622] text-base focus:outline-none focus:border-[#96321F] text-center"
            placeholder="score"
          />
          {rows.length > 1 && (
            <button onClick={() => removeRow(i)} className="text-[#9E8F7E] hover:text-red-500 text-xl px-1 leading-none">×</button>
          )}
        </div>
      ))}

      <button onClick={addRow} className="text-xs text-[#96321F]/70 hover:text-[#96321F] transition-colors">
        + Add player
      </button>

      <button
        onClick={submitScores}
        disabled={saving || rows.every(r => !r.userId)}
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

// ── Reusable player search dropdown ─────────────────────────

function PlayerSearch({
  members, memberMap, excludeIds, selectedId, onSelect, onClear,
}: {
  members: MemberOption[]
  memberMap: Record<string, string>
  excludeIds: string[]
  selectedId: string
  onSelect: (id: string) => void
  onClear: () => void
}) {
  const [search, setSearch]             = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return members.filter(m => !excludeIds.includes(m.id)).slice(0, 10)
    return members
      .filter(m => !excludeIds.includes(m.id) && memberLabel(m).toLowerCase().includes(q))
      .slice(0, 10)
  }, [search, members, excludeIds])

  function pick(id: string) {
    onSelect(id)
    setSearch('')
    setShowDropdown(false)
  }

  if (selectedId) {
    return (
      <div className="flex items-center gap-1.5 bg-[#FFFFFF] border border-[#C8BCA4] rounded-lg px-3 min-h-[44px]">
        <span className="flex-1 text-sm text-[#242622] truncate">{memberMap[selectedId] ?? selectedId}</span>
        <button
          onClick={() => { onClear(); setTimeout(() => inputRef.current?.focus(), 50) }}
          className="text-[#9E8F7E] hover:text-red-500 text-lg leading-none shrink-0"
        >
          ×
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={search}
        onChange={e => { setSearch(e.target.value); setShowDropdown(true) }}
        onFocus={() => setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
        placeholder="Search player…"
        className="w-full bg-[#FFFFFF] border border-[#C8BCA4] rounded-lg px-3 min-h-[44px] text-[#242622] text-base focus:outline-none focus:border-[#96321F]"
      />
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          {suggestions.map(m => (
            <button
              key={m.id}
              onMouseDown={() => pick(m.id)}
              className="w-full text-left px-3 py-2.5 text-sm text-[#242622] hover:bg-[#F1F1E7] transition-colors"
            >
              {memberLabel(m)}
            </button>
          ))}
        </div>
      )}
      {showDropdown && search.trim() && suggestions.length === 0 && (
        <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl shadow-sm px-3 py-2.5">
          <p className="text-xs text-[#9E8F7E]">No players found</p>
        </div>
      )}
    </div>
  )
}
