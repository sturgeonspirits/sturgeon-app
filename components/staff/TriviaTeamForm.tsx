'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { LeaderboardPeriod } from '@/lib/supabase/types'

interface Member {
  id: string
  display_name: string | null
  full_name: string | null
  phone: string | null
  email?: string | null
}

function memberLabel(m: Member) {
  const name = m.full_name ?? m.display_name ?? m.email ?? '?'
  return m.phone ? `${name} · ${m.phone}` : name
}

interface SavedTemplate {
  id: string
  name: string
  trivia_team_members: { user_id: string; profiles: { id: string; display_name: string | null; full_name: string | null } | null }[]
}

/** A registered team already in leaderboard_teams for this period */
interface RegisteredTeam {
  teamId: string            // leaderboard_teams.id
  permanentTeamId: string | null  // permanent_teams.id
  name: string
  score: number | null
  placement: number | null
  members: { userId: string; name: string }[]
}

interface TeamRow {
  name:               string
  score:              number | ''
  memberIds:          string[]
  savedId?:           string        // trivia_teams template id
  existingTeamId?:    string        // leaderboard_teams.id (if pre-registered)
  permanentTeamId?:   string | null // permanent_teams.id (for rename/delete)
  isRegistered?:      boolean       // true if loaded from customer sign-up
}

interface Props {
  period:      LeaderboardPeriod
  members:     Member[]
  staffId:     string
  eventTypeId: string
  eventId?:    string | null
}

export default function TriviaTeamForm({ period, members, staffId, eventTypeId, eventId }: Props) {
  const [teams,      setTeams]      = useState<TeamRow[]>([])
  const [templates,  setTemplates]  = useState<SavedTemplate[]>([])
  const [loaded,     setLoaded]     = useState(false)
  const [selected,   setSelected]   = useState<Set<string>>(new Set())
  const [saving,     setSaving]     = useState(false)
  const [message,    setMessage]    = useState('')

  // ── Rename / Delete state ──────────────────────────────
  const [renaming,      setRenaming]      = useState<Record<string, string>>({})
  const [renameError,   setRenameError]   = useState<Record<string, string>>({})
  const [renameSaving,  setRenameSaving]  = useState<Set<string>>(new Set())
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting,      setDeleting]      = useState<string | null>(null)

  // Build a display name lookup
  const memberMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const mb of members) m[mb.id] = memberLabel(mb)
    return m
  }, [members])

  // ── Load registered teams + saved templates on mount ──
  const loadData = useCallback(async () => {
    setLoaded(false)
    try {
      // Fetch both in parallel
      const params = new URLSearchParams({ periodId: period.id })
      if (eventId) params.set('eventId', eventId)
      const [signupsRes, templatesRes] = await Promise.all([
        fetch(`/api/staff/period-signups?${params}`),
        fetch(`/api/staff/trivia-teams?eventTypeId=${eventTypeId}`),
      ])
      const signupsJson  = await signupsRes.json()
      const templatesJson = await templatesRes.json()

      setTemplates(templatesJson.teams ?? [])

      // Convert registered teams into TeamRow cards
      const registered: RegisteredTeam[] = signupsJson.teams ?? []
      const cards: TeamRow[] = registered.map(rt => ({
        name:             rt.name,
        score:            rt.score ?? '',
        memberIds:        rt.members.map(m => m.userId),
        existingTeamId:   rt.teamId,
        permanentTeamId:  rt.permanentTeamId,
        isRegistered:     true,
      }))
      setTeams(cards)
    } catch (err) {
      console.error('Failed to load teams:', err)
    }
    setLoaded(true)
  }, [period.id, eventId, eventTypeId])

  useEffect(() => { loadData() }, [loadData])

  // ── Template selection helpers ─────────────────────────
  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(templates.map(t => t.id)))
  }

  function loadSelected() {
    const toLoad = templates.filter(st => selected.has(st.id))
    const newCards: TeamRow[] = toLoad.map(st => ({
      name:      st.name,
      score:     '',
      memberIds: st.trivia_team_members
        .map(m => m.user_id)
        .filter(id => members.some(mb => mb.id === id)),
      savedId:   st.id,
    }))
    setTeams(prev => [...prev, ...newCards])
    setSelected(new Set())
  }

  // ── Team card mutations ────────────────────────────────
  function addBlankTeam() {
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

  // ── Rename permanent team ──────────────────────────────
  async function saveRename(teamIdx: number) {
    const team = teams[teamIdx]
    const ptId = team.permanentTeamId
    if (!ptId) return
    const newName = renaming[ptId]?.trim()
    if (!newName) { setRenameError(e => ({ ...e, [ptId]: 'Name cannot be empty' })); return }
    setRenameSaving(s => new Set([...s, ptId]))
    setRenameError(e => ({ ...e, [ptId]: '' }))

    const res = await fetch('/api/staff/team', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId: ptId, name: newName }),
    })
    const json = await res.json()

    if (!res.ok) {
      setRenameError(e => ({ ...e, [ptId]: json.error ?? 'Could not rename' }))
      setRenameSaving(s => { const n = new Set(s); n.delete(ptId); return n })
      return
    }

    // Update the card's name
    setTeamField(teamIdx, 'name', newName)
    setRenaming(r => { const n = { ...r }; delete n[ptId]; return n })
    setRenameSaving(s => { const n = new Set(s); n.delete(ptId); return n })
    setMessage(`Team renamed to "${newName}" ✓`)
    setTimeout(() => setMessage(''), 3000)
  }

  // ── Delete permanent team ──────────────────────────────
  async function confirmDeleteTeam(teamIdx: number) {
    const team = teams[teamIdx]
    const ptId = team.permanentTeamId
    if (!ptId) return
    setDeleting(ptId)

    const res = await fetch('/api/staff/team', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId: ptId }),
    })
    const json = await res.json()

    if (!res.ok) {
      setMessage(json.error ?? 'Could not delete team')
      setDeleting(null)
      setDeleteConfirm(null)
      return
    }

    // Remove the card
    removeTeam(teamIdx)
    setDeleteConfirm(null)
    setDeleting(null)
    setMessage(`Team "${team.name}" deleted ✓`)
    setTimeout(() => setMessage(''), 3000)
  }

  // Save current roster back to trivia_teams template
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
      const refreshed = await fetch(`/api/staff/trivia-teams?eventTypeId=${eventTypeId}`).then(r => r.json())
      setTemplates(refreshed.teams ?? [])
      setTeamField(teamIdx, 'savedId', json.id)
      setMessage(`"${team.name}" roster saved ✓`)
      setTimeout(() => setMessage(''), 3000)
    }
  }

  // ── Submit scores ──────────────────────────────────────
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
          name:           t.name,
          score:          Number(t.score),
          placement:      i + 1,
          memberIds:      t.memberIds,
          existingTeamId: t.existingTeamId ?? undefined,
        })),
      }),
    })

    const json = await res.json()
    if (res.ok) {
      setMessage(`Scores saved for ${valid.length} team${valid.length > 1 ? 's' : ''} ✓`)
      // Reload to refresh state
      await loadData()
    } else {
      setMessage(json.error ?? 'Error saving scores')
    }
    setSaving(false)
  }

  const allUsedIds = teams.flatMap(t => t.memberIds)

  // ── Render ─────────────────────────────────────────────

  const registeredTeams = teams.filter(t => t.isRegistered)
  const manualTeams     = teams.filter(t => !t.isRegistered)

  return (
    <div className="space-y-4">

      {/* ── Loading state ────────────────────────────── */}
      {!loaded && (
        <p className="text-xs text-[#9E8F7E]">Loading teams…</p>
      )}

      {/* ── Registered teams (from customer sign-up) ── */}
      {loaded && registeredTeams.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-[#87A67F] uppercase tracking-widest">
              Registered teams · {registeredTeams.length}
            </p>
            <button onClick={loadData} className="text-xs text-[#9E8F7E] hover:text-[#7E613F] transition-colors">↻ Refresh</button>
          </div>
          {registeredTeams.map((team, _i) => {
            const teamIdx = teams.indexOf(team)
            const ptId = team.permanentTeamId
            const isRenaming = ptId && ptId in renaming
            const isDeleteConfirm = ptId && deleteConfirm === ptId

            return (
              <div
                key={team.existingTeamId ?? teamIdx}
                className="bg-[#FFFFFF] border border-[#87A67F]/30 rounded-xl p-4 space-y-3"
              >
                {/* Header with team name + actions */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#87A67F] uppercase tracking-widest shrink-0">
                    ✓ Registered
                  </span>
                  <div className="flex-1" />
                  {ptId && !isRenaming && !isDeleteConfirm && (
                    <>
                      <button
                        onClick={() => {
                          setRenaming(r => ({ ...r, [ptId]: team.name }))
                          setRenameError(e => ({ ...e, [ptId]: '' }))
                        }}
                        className="text-xs text-[#7E613F] hover:text-[#96321F] transition-colors"
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(ptId)}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>

                {/* Rename inline */}
                {isRenaming && ptId && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={renaming[ptId] ?? ''}
                      onChange={e => setRenaming(r => ({ ...r, [ptId]: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveRename(teamIdx)
                        if (e.key === 'Escape') setRenaming(r => { const n = { ...r }; delete n[ptId]; return n })
                      }}
                      disabled={renameSaving.has(ptId)}
                      autoFocus
                      className="w-full border border-[#C8BCA4] focus:border-[#96321F] rounded-xl px-3 py-2 text-[#242622] text-sm focus:outline-none disabled:opacity-50"
                    />
                    {renameError[ptId] && <p className="text-xs text-red-600">{renameError[ptId]}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveRename(teamIdx)}
                        disabled={renameSaving.has(ptId)}
                        className="flex-1 bg-[#96321F] text-white text-sm font-semibold py-2 rounded-xl disabled:opacity-40 hover:bg-[#ae3a24] transition-colors"
                      >
                        {renameSaving.has(ptId) ? 'Saving…' : 'Save name'}
                      </button>
                      <button
                        onClick={() => setRenaming(r => { const n = { ...r }; delete n[ptId]; return n })}
                        className="px-4 py-2 border border-[#D4CFC3] text-[#7E613F] text-sm rounded-xl hover:bg-[#F5F2EC] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Delete confirm */}
                {isDeleteConfirm && ptId && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
                    <p className="text-sm text-[#242622]">
                      Delete <strong>{team.name}</strong>? This removes the team from all events.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => confirmDeleteTeam(teamIdx)}
                        disabled={deleting === ptId}
                        className="flex-1 bg-red-600 text-white text-sm font-semibold py-2 rounded-xl disabled:opacity-40 hover:bg-red-700 transition-colors"
                      >
                        {deleting === ptId ? 'Deleting…' : 'Yes, delete'}
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-4 py-2 border border-[#D4CFC3] text-[#7E613F] text-sm rounded-xl hover:bg-[#F5F2EC] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Team name + Score (only show when not renaming/deleting) */}
                {!isRenaming && !isDeleteConfirm && (
                  <div className="flex gap-2 items-center">
                    <p className="flex-1 font-semibold text-[#242622] truncate">{team.name}</p>
                    <input
                      type="number"
                      min={0}
                      value={team.score}
                      onChange={e => setTeamField(teamIdx, 'score', e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                      placeholder="Score"
                      className="w-24 border border-[#D4CFC3] rounded-lg px-3 py-2 text-sm text-[#242622] text-center focus:outline-none focus:border-[#96321F] transition-colors"
                    />
                  </div>
                )}

                {/* Members */}
                {team.memberIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {team.memberIds.map(id => (
                      <span
                        key={id}
                        className="flex items-center gap-1 bg-[#87A67F]/10 text-[#87A67F] text-xs px-2.5 py-1 rounded-full font-medium"
                      >
                        {memberMap[id] ?? id}
                      </span>
                    ))}
                  </div>
                )}

                {/* Add member search for registered teams */}
                <MemberSearch
                  members={members}
                  memberMap={memberMap}
                  excludeIds={team.memberIds}
                  allUsedIds={allUsedIds}
                  onPick={id => addMember(teamIdx, id)}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* ── Saved team template selector ─────────────── */}
      {loaded && templates.length > 0 && (
        <div className="bg-[#F7F5EF] border border-[#D4CFC3] rounded-xl p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-[#7E613F] uppercase tracking-widest">
              Saved teams
            </p>
            {templates.length > 1 && (
              <button onClick={selectAll} className="text-xs text-[#96321F] font-semibold hover:underline">
                Select all
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {templates.map(st => {
              const isSelected = selected.has(st.id)
              const isLoaded = teams.some(t => t.savedId === st.id)
              return (
                <button
                  key={st.id}
                  onClick={() => !isLoaded && toggleSelect(st.id)}
                  disabled={isLoaded}
                  className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border font-medium transition-all ${
                    isLoaded
                      ? 'bg-[#87A67F]/15 border-[#87A67F]/40 text-[#87A67F] cursor-default'
                      : isSelected
                        ? 'bg-[#96321F] border-[#96321F] text-white'
                        : 'bg-[#FFFFFF] border-[#D4CFC3] text-[#242622] hover:border-[#96321F]'
                  }`}
                >
                  {(isLoaded || isSelected) && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                  {st.name}
                  <span className="text-[10px] opacity-60">({st.trivia_team_members.length})</span>
                </button>
              )
            })}
          </div>

          {selected.size > 0 && (
            <button
              onClick={loadSelected}
              className="w-full bg-[#96321F] text-white text-sm font-semibold py-2 rounded-xl hover:bg-[#ae3a24] transition-colors"
            >
              Load {selected.size} team{selected.size > 1 ? 's' : ''} →
            </button>
          )}
        </div>
      )}

      {/* ── Manual team cards (added by staff) ───────── */}
      {manualTeams.length > 0 && (
        <div className="space-y-3">
          {manualTeams.map((team, _i) => {
            const teamIdx = teams.indexOf(team)
            return (
              <TeamCard
                key={teamIdx}
                index={teamIdx}
                team={team}
                members={members}
                memberMap={memberMap}
                allUsedIds={allUsedIds}
                canRemove={true}
                onRemove={() => removeTeam(teamIdx)}
                onSetField={(field, value) => setTeamField(teamIdx, field, value)}
                onAddMember={id => addMember(teamIdx, id)}
                onRemoveMember={id => removeMember(teamIdx, id)}
                onSaveRoster={() => saveRoster(teamIdx)}
              />
            )
          })}
        </div>
      )}

      {/* ── Bottom actions ────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={addBlankTeam}
          className="text-sm text-[#96321F] hover:text-[#ae3a24] font-semibold transition-colors"
        >
          + Add team
        </button>
      </div>

      {teams.length > 0 && (
        <button
          onClick={submitTeams}
          disabled={saving || teams.every(t => !t.name || t.score === '' || t.memberIds.length === 0)}
          className="w-full bg-[#96321F] text-white font-semibold py-2.5 rounded-xl disabled:opacity-40 text-sm hover:bg-[#ae3a24] transition-colors"
        >
          {saving ? 'Saving scores…' : 'Submit Results'}
        </button>
      )}

      {loaded && teams.length === 0 && (
        <div className="text-center py-8 bg-[#F7F5EF] border border-[#D4CFC3] rounded-xl">
          <p className="text-2xl mb-2">🎯</p>
          <p className="text-sm text-[#7E613F]">No teams registered yet.</p>
          <p className="text-xs text-[#9E8F7E] mt-1">Teams appear when customers scan the QR code, or add one manually above.</p>
        </div>
      )}

      {message && (
        <p className={`text-sm font-medium ${message.includes('✓') ? 'text-[#87A67F]' : 'text-red-500'}`}>
          {message}
        </p>
      )}
    </div>
  )
}

// ── Member search dropdown ──────────────────────────────────

function MemberSearch({
  members, memberMap, excludeIds, allUsedIds, onPick,
}: {
  members: Member[]
  memberMap: Record<string, string>
  excludeIds: string[]
  allUsedIds: string[]
  onPick: (id: string) => void
}) {
  const [search, setSearch]             = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return members
      .filter(m => !excludeIds.includes(m.id) && memberLabel(m).toLowerCase().includes(q))
      .slice(0, 8)
  }, [search, members, excludeIds])

  function pick(id: string) {
    onPick(id)
    setSearch('')
    setShowDropdown(false)
    searchRef.current?.focus()
  }

  return (
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
            const onOther = allUsedIds.includes(m.id) && !excludeIds.includes(m.id)
            return (
              <button
                key={m.id}
                onMouseDown={() => pick(m.id)}
                disabled={onOther}
                className={`w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center justify-between ${
                  onOther
                    ? 'text-[#C8BCA4] cursor-not-allowed'
                    : 'text-[#242622] hover:bg-[#F1F1E7]'
                }`}
              >
                <span>{memberLabel(m)}</span>
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
  )
}

// ── Manual team card (staff-added) ──────────────────────────

interface TeamCardProps {
  index:          number
  team:           TeamRow
  members:        Member[]
  memberMap:      Record<string, string>
  allUsedIds:     string[]
  canRemove:      boolean
  onRemove:       () => void
  onSetField:     (field: keyof TeamRow, value: any) => void
  onAddMember:    (id: string) => void
  onRemoveMember: (id: string) => void
  onSaveRoster:   () => void
}

function TeamCard({
  index, team, members, memberMap, allUsedIds,
  canRemove, onRemove, onSetField, onAddMember, onRemoveMember, onSaveRoster,
}: TeamCardProps) {
  return (
    <div className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl p-4 space-y-3">
      {/* Header */}
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
      <MemberSearch
        members={members}
        memberMap={memberMap}
        excludeIds={team.memberIds}
        allUsedIds={allUsedIds}
        onPick={id => onAddMember(id)}
      />

      {/* Save roster */}
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
