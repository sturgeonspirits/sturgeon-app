'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface Team {
  id:          string
  name:        string
  periodCount: number
  lastPlayed:  string | null
}

export interface EventTypeGroup {
  id:   string
  name: string
  icon: string
  teams: Team[]
}

export default function TeamManager({ groups }: { groups: EventTypeGroup[] }) {
  const router = useRouter()

  // { [teamId]: 'rename' | 'deleting' | 'saving' }
  const [mode,       setMode]       = useState<Record<string, string>>({})
  const [draftName,  setDraftName]  = useState<Record<string, string>>({})
  const [error,      setError]      = useState<Record<string, string>>({})
  const [deleted,    setDeleted]    = useState<Set<string>>(new Set())

  function startRename(team: Team) {
    setMode(m => ({ ...m, [team.id]: 'rename' }))
    setDraftName(d => ({ ...d, [team.id]: team.name }))
    setError(e => ({ ...e, [team.id]: '' }))
  }

  function cancelRename(id: string) {
    setMode(m => { const n = { ...m }; delete n[id]; return n })
    setError(e => ({ ...e, [id]: '' }))
  }

  async function saveRename(id: string) {
    const name = draftName[id]?.trim()
    if (!name) { setError(e => ({ ...e, [id]: 'Name cannot be empty' })); return }
    setMode(m => ({ ...m, [id]: 'saving' }))
    setError(e => ({ ...e, [id]: '' }))

    const res  = await fetch('/api/staff/team', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ teamId: id, name }),
    })
    const json = await res.json()

    if (!res.ok) {
      setMode(m => ({ ...m, [id]: 'rename' }))
      setError(e => ({ ...e, [id]: json.error ?? 'Could not rename' }))
      return
    }
    setMode(m => { const n = { ...m }; delete n[id]; return n })
    router.refresh()
  }

  function startDelete(id: string) {
    setMode(m => ({ ...m, [id]: 'confirm-delete' }))
    setError(e => ({ ...e, [id]: '' }))
  }

  async function confirmDelete(id: string) {
    setMode(m => ({ ...m, [id]: 'deleting' }))
    const res  = await fetch('/api/staff/team', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ teamId: id }),
    })
    const json = await res.json()

    if (!res.ok) {
      setMode(m => ({ ...m, [id]: 'confirm-delete' }))
      setError(e => ({ ...e, [id]: json.error ?? 'Could not delete' }))
      return
    }
    setDeleted(s => new Set([...s, id]))
    setMode(m => { const n = { ...m }; delete n[id]; return n })
  }

  const allEmpty = groups.every(g => g.teams.filter(t => !deleted.has(t.id)).length === 0)

  return (
    <div className="space-y-8">
      {allEmpty && (
        <div className="text-center py-16 bg-white border border-[#D4CFC3] rounded-2xl">
          <p className="text-4xl mb-3">🎮</p>
          <p className="font-semibold text-[#242622]">No teams yet</p>
          <p className="text-sm text-[#7E613F] mt-1">Teams appear here once customers sign up for an event</p>
        </div>
      )}

      {groups.map(group => {
        const visible = group.teams.filter(t => !deleted.has(t.id))
        if (visible.length === 0) return null
        return (
          <section key={group.id}>
            {/* Event type header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-[#96321F]/10 border border-[#96321F]/20 flex items-center justify-center text-lg shrink-0">
                {group.icon}
              </div>
              <div>
                <h2 className="font-bold text-[#242622]">{group.name}</h2>
                <p className="text-xs text-[#9E8F7E]">{visible.length} team{visible.length !== 1 ? 's' : ''}</p>
              </div>
            </div>

            <div className="space-y-2">
              {visible.map(team => {
                const m = mode[team.id]
                const err = error[team.id]

                return (
                  <div
                    key={team.id}
                    className="bg-white border border-[#D4CFC3] rounded-2xl px-4 py-3"
                  >
                    {/* ── Rename mode ── */}
                    {(m === 'rename' || m === 'saving') && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={draftName[team.id] ?? team.name}
                          onChange={e => setDraftName(d => ({ ...d, [team.id]: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveRename(team.id)
                            if (e.key === 'Escape') cancelRename(team.id)
                          }}
                          disabled={m === 'saving'}
                          autoFocus
                          className="w-full border border-[#C8BCA4] focus:border-[#96321F] rounded-xl px-3 py-2 text-[#242622] text-sm focus:outline-none disabled:opacity-50"
                        />
                        {err && <p className="text-xs text-red-600">{err}</p>}
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveRename(team.id)}
                            disabled={m === 'saving'}
                            className="flex-1 bg-[#96321F] text-white text-sm font-semibold py-2 rounded-xl disabled:opacity-40 hover:bg-[#ae3a24] transition-colors"
                          >
                            {m === 'saving' ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            onClick={() => cancelRename(team.id)}
                            disabled={m === 'saving'}
                            className="px-4 py-2 border border-[#D4CFC3] text-[#7E613F] text-sm rounded-xl hover:bg-[#F5F2EC] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── Delete confirm mode ── */}
                    {(m === 'confirm-delete' || m === 'deleting') && (
                      <div className="space-y-2">
                        <p className="text-sm text-[#242622]">
                          Delete <strong>{team.name}</strong>?
                          {team.periodCount > 0 && (
                            <span className="text-[#9E8F7E]"> This will remove them from {team.periodCount} past event{team.periodCount !== 1 ? 's' : ''}.</span>
                          )}
                        </p>
                        {err && <p className="text-xs text-red-600">{err}</p>}
                        <div className="flex gap-2">
                          <button
                            onClick={() => confirmDelete(team.id)}
                            disabled={m === 'deleting'}
                            className="flex-1 bg-red-600 text-white text-sm font-semibold py-2 rounded-xl disabled:opacity-40 hover:bg-red-700 transition-colors"
                          >
                            {m === 'deleting' ? 'Deleting…' : 'Yes, delete'}
                          </button>
                          <button
                            onClick={() => setMode(mm => { const n = { ...mm }; delete n[team.id]; return n })}
                            disabled={m === 'deleting'}
                            className="px-4 py-2 border border-[#D4CFC3] text-[#7E613F] text-sm rounded-xl hover:bg-[#F5F2EC] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── Default row ── */}
                    {!m && (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[#242622] truncate">{team.name}</p>
                          <p className="text-xs text-[#9E8F7E] mt-0.5">
                            {team.periodCount === 0
                              ? 'Never played'
                              : `Played ${team.periodCount} time${team.periodCount !== 1 ? 's' : ''}${team.lastPlayed ? ` · last ${team.lastPlayed}` : ''}`}
                          </p>
                        </div>
                        <button
                          onClick={() => startRename(team)}
                          className="text-xs text-[#7E613F] border border-[#D4CFC3] px-3 py-1.5 rounded-lg hover:border-[#96321F] hover:text-[#96321F] transition-colors"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => startDelete(team.id)}
                          className="text-xs text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
