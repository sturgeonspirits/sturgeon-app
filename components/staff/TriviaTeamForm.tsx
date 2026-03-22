'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import type { LeaderboardPeriod } from '@/lib/supabase/types'

interface Member {
  id: string
  display_name: string | null
  email?: string | null
}

interface SavedTeam {
  id: string
  name: string
  trivia_team_members: { user_id: string; profiles: { id: string; display_name: string | null; full_name: string | null } | null }[]
}

interface TeamRow {
  name:      string
  score:     number | ''
  memberIds: string[]
  savedId?:  string   // id of the saved template this was loaded from
}

interface Props {
  period:      LeaderboardPeriod
  members:     Member[]
  staffId:     string
  eventTypeId: string
}

export default function TriviaTeamForm({ period, members, staffId, eventTypeId }: Props) {
  const [teams,      setTeams]      = useState<TeamRow[]>([{ name: '', score: '', memberIds: [] }])
  const [savedTeams, setSavedTeams] = useState<SavedTeam[]>([])
  const [saving,     setSaving]     = useState(false)
  const [message,    setMessage]    = useState('')

  // Load saved team templates for this event type
  useEffect(() => {
    fetch(`/api/staff/trivia-teams?eventTypeId=${eventTypeId}`)
      .then(r => r.json())
      .then(d => setSavedTeams(d.teams ?? []))
      .catch(() => {})
  }, [eventTypeId])

  // Build a display name lookup
  const memberMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const mb of members) {
      m[mb.id] = mb.display_name ?? mb.email ?? mb.id
    }
    return m
  }, [members])

  // ── Team mutations ────────────────────────────────────────

  function addTeam() {
    setTeams(t => [...t, { name: '', score: '', memberIds: [] }])
  }
  function removeTeam(i: number) {
    setTeams(t => t.filter((_, j) => j !== i))
  }
  function setTeamField<K extends keyof TeamRow>(i: number, field: K, value: TeamRow[K]) {
    setTeams(t => t.map((team, j) => j === i ? { ...team, [field]: value } : team))
  }
  function addMember(teamIdx: number, memberId: string) {
    setTeams(t => t.map((team, j) => {
      if (j !== teamIdx || team.memberIds.includes(memberId)) return team
      return { ...team, memberIds: [...team.memberIds, memberId] }
    }))
  }
  function removeMember(teamIdx: number, memberId: string) {
    setTeams(t => t.map((team, j) =>
      j === teamIdx ? { ...team, memberIds: team.memberIds.filter(id => id !== memberId) } : team
    ))
  }

  // Load a saved team template into a slot
  function loadSavedTeam(teamIdx: number, saved: SavedTeam) {
    const memberIds = saved.trivia_team_members
      .map(m => m.user_id)
      .filter(id => members.some(mb => mb.id === id)) // only load members who exist
    setTeams(t => t.map((team, j) =>
      j === teamIdx
        ? { name: saved.name, score: team.score, memberIds, savedId: saved.id }
        : team
    ))
  }

  // Save current roster back to template (or create new)
  async function saveRoster(teamIdx: number) {
    const team = teams[teamIdx]
    if (!team.name) return
    const res = await fetch('/api/staff/trivia-teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id:          team.savedId,
        name:        team.name,
        eventTypeId,
        memberIds:   team.memberIds,
      }),
    })
    const json = await res.json()
    if (res.ok) {
      // Refresh saved teams and update the savedId
      const saved = await fetch(`/api/staff/trivia-teams?eventTypeId=${eventTypeId}`)
        .then(r => r.json())
      setSavedTeams(saved.teams ?? [])
      setTeamField(teamIdx, 'savedId', json.id)
      setMessage(`"${team.name}" roster saved ✓`)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  // ── Submit scores ─────────────────────────────────────────

  async function submitTeams() {
    const valid = teams.filter(t => t.name && t.score !== '' && t.memberIds.length > 0)
    if (valid.length === 0) return
    setSaving(true)
    setMessage('')

    const sorted = [...valid].sort((a, b) => Number(b.score) - Number(a.score))

    const res = await fetch('/api/staff/leaderboard-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        periodId:      period.id,
        scoringMethod: 'placement',
        staffId,
        teams: sorted.map((t, i) => ({
          name:      t.name,
          score:     Number(t.score),
          placement: i + 1,
          memberIds: t.memberIds,
        })),
      }),
    })

    const json = await res.json()
    if (res.ok) {
      setMessage(`Scores saved for ${valid.length} team${valid.length > 1 ? 's' : ''} ✓`)
      setTeams([{ name: '', score: '', memberIds: [] }])
    } else {
      setMessage(json.error ?? 'Error saving scores')
    }
    setSaving(false)
  }

  const allUsedIds = teams.flatMap(t => t.memberIds)

  return (
    <div className="space-y-4">
      <p className="text-xs text-[#7E613F]">
        {members.length} members in roster · Load a saved team or build from scratch
      </p>

      {teams.map((team, i) => (
        <TeamCard
          key={i}
          index={i}
          team={team}
          members={members}
          memberMap={memberMap}
          savedTeams={savedTeams}
          allUsedIds={allUsedIds}
          canRemove={teams.length > 1}
          onRemove={() => removeTeam(i)}
          onSetField={(field, value) => setTeamField(i, field, value)}
          onAddMember={id => addMember(i, id)}
          onRemoveMember={id => removeMember(i, id)}
          onLoadSaved={saved => loadSavedTeam(i, saved)}
          onSaveRoster={() => saveRoster(i)}
        />
      ))}

      <button
        onClick={addTeam}
        className="text-sm text-[#96321F] hover:text-[#ae3a24] font-semibold transition-colors"
      >
        + Add another team
      </button>

      <button
        onClick={submitTeams}
        disabled={saving || teams.every(t => !t.name || t.score === '' || t.memberIds.length === 0)}
        className="w-full bg-[#96321F] text-white font-semibold py-2.5 rounded-xl disabled:opacity-40 text-sm hover:bg-[#ae3a24] transition-colors"
      >
        {saving ? 'Saving scores…' : 'Submit Results'}
      </button>

      {message && (
        <p className={`text-sm font-medium ${message.includes('✓') ? 'text-[#87A67F]' : 'text-red-500'}`}>
          {message}
        </p>
      )}
    </div>
  )
}

// ── Individual team card ──────────────────────────────────────

interface TeamCardProps {
  index:          number
  team:           TeamRow
  members:        Member[]
  memberMap:      Record<string, string>
  savedTeams:     SavedTeam[]
  allUsedIds:     string[]
  canRemove:      boolean
  onRemove:       () => void
  onSetField:     (field: keyof TeamRow, value: any) => void
  onAddMember:    (id: string) => void
  onRemoveMember: (id: string) => void
  onLoadSaved:    (saved: SavedTeam) => void
  onSaveRoster:   () => void
}

function TeamCard({
  index, team, members, memberMap, savedTeams, allUsedIds,
  canRemove, onRemove, onSetField, onAddMember, onRemoveMember, onLoadSaved, onSaveRoster,
}: TeamCardProps) {
  const [search,       setSearch]       = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return members
      .filter(m =>
        !team.memberIds.includes(m.id) &&
        (m.display_name ?? m.email ?? '').toLowerCase().includes(q)
      )
      .slice(0, 8)
  }, [search, members, team.memberIds])

  function pickMember(id: string) {
    onAddMember(id)
    setSearch('')
    setShowDropdown(false)
    searchRef.current?.focus()
  }

  return (
    <div className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-[#96321F] uppercase tracking-widest shrink-0">
          Team {index + 1}
        </span>
        {canRemove && (
          <button onClick={onRemove} className="ml-auto text-xs text-[#C8BCA4] hover:text-red-400 transition-colors">
            Remove
          </button>
        )}
      </div>

      {/* Name + Score */}
      <div className="flex gap-2">
        <input
          type="text"
          value={team.name}
          onChange={e => onSetField('name', e.target.value)}
          placeholder="Team name…"
          className="flex-1 border border-[#D4CFC3] rounded-lg px-3 py-2 text-sm text-[#242622] focus:outline-none focus:border-[#96321F] transition-colors"
        />
        <input
          type="number"
          min={0}
          value={team.score}
          onChange={e => onSetField('score', e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
          placeholder="Score"
          className="w-20 border border-[#D4CFC3] rounded-lg px-3 py-2 text-sm text-[#242622] text-center focus:outline-none focus:border-[#96321F] transition-colors"
        />
      </div>

      {/* Load saved team */}
      {savedTeams.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowTemplates(!showTemplates)}
            className="text-xs text-[#7E613F] hover:text-[#96321F] font-medium transition-colors flex items-center gap-1"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            Load saved team
            <svg className={`transition-transform ${showTemplates ? 'rotate-180' : ''}`} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {showTemplates && (
            <div className="absolute top-6 left-0 z-20 bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl shadow-lg min-w-48 py-1 max-h-48 overflow-y-auto">
              {savedTeams.map(st => (
                <button
                  key={st.id}
                  onClick={() => { onLoadSaved(st); setShowTemplates(false) }}
                  className="w-full text-left px-3 py-2 text-sm text-[#242622] hover:bg-[#F1F1E7] transition-colors"
                >
                  <span className="font-medium">{st.name}</span>
                  <span className="text-xs text-[#9E8F7E] ml-1.5">
                    ({st.trivia_team_members.length} members)
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Current members */}
      {team.memberIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {team.memberIds.map(id => (
            <span
              key={id}
              className="flex items-center gap-1 bg-[#96321F]/10 text-[#96321F] text-xs px-2.5 py-1 rounded-full font-medium"
            >
              {memberMap[id] ?? id}
              <button
                onClick={() => onRemoveMember(id)}
                className="hover:text-red-600 transition-colors ml-0.5 leading-none"
                aria-label="Remove"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Member search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C8BCA4] pointer-events-none"
          width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setShowDropdown(true) }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          placeholder="Add member by name…"
          className="w-full border border-[#D4CFC3] rounded-lg pl-8 pr-3 py-2 text-sm text-[#242622] placeholder-[#C8BCA4] focus:outline-none focus:border-[#96321F] transition-colors"
        />
        {showDropdown && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
            {suggestions.map(m => {
              const onOther = allUsedIds.includes(m.id) && !team.memberIds.includes(m.id)
              return (
                <button
                  key={m.id}
                  onMouseDown={() => pickMember(m.id)}
                  disabled={onOther}
                  className={`w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center justify-between ${
                    onOther
                      ? 'text-[#C8BCA4] cursor-not-allowed'
                      : 'text-[#242622] hover:bg-[#F1F1E7]'
                  }`}
                >
                  <span>{m.display_name ?? m.email}</span>
                  {onOther && <span className="text-[10px] text-[#C8BCA4]">on another team</span>}
                </button>
              )
            })}
          </div>
        )}
        {showDropdown && search.trim() && suggestions.length === 0 && (
          <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl shadow-sm px-3 py-2.5">
            <p className="text-xs text-[#9E8F7E]">No members found</p>
          </div>
        )}
      </div>

      {/* Save roster link */}
      {team.memberIds.length > 0 && team.name && (
        <button
          type="button"
          onClick={onSaveRoster}
          className="text-xs text-[#7E613F] hover:text-[#96321F] font-medium transition-colors flex items-center gap-1"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          {team.savedId ? 'Update saved roster' : 'Save as team template'}
        </button>
      )}
    </div>
  )
}
