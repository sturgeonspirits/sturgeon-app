'use client'
// ─────────────────────────────────────────────
// Changelog
//   v2026-08-14.1 — Tag roster members in the player picker so staff can tell
//                   them apart from real accounts.
// ─────────────────────────────────────────────

import { useState, useRef, useMemo } from 'react'
import type { LeaderboardPeriod } from '@/lib/supabase/types'

interface Props {
  period:  LeaderboardPeriod
  members: { id: string; display_name: string | null; full_name: string | null; phone: string | null; email: string | null; is_roster?: boolean | null }[]
  staffId: string
}

type MemberOption = Props['members'][number]
function memberLabel(m: MemberOption) {
  const name = m.full_name ?? m.display_name ?? m.email ?? '?'
  const base = m.phone ? `${name} · ${m.phone}` : name
  // Roster members are name-only: they play and keep a record, but earn nothing.
  return m.is_roster ? `${base} · roster` : base
}

interface PlayerRow {
  userId: string
  wins:   string
  spread: string
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
    try { json = await res.json() } catch {}
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

  // Build member name map for display
  const memberMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const mb of members) m[mb.id] = memberLabel(mb)
    return m
  }, [members])

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

      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_80px_96px_24px] gap-2 items-center">
          {/* Player search */}
          <PlayerSearch
            members={members}
            memberMap={memberMap}
            excludeIds={usedIds.filter(id => id !== row.userId)}
            selectedId={row.userId}
            onSelect={id => updateRow(i, 'userId', id)}
            onClear={() => updateRow(i, 'userId', '')}
          />

          {/* Wins: tap 0–3 */}
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

          {/* Point spread */}
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
      ))}

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

  // If a player is selected, show their name as a chip
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
