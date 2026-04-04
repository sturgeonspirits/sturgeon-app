'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Team {
  periodTeamId: string
  permanentTeamId: string
  name: string
  memberCount: number
  members: string[]
  isMine: boolean
}

interface Props {
  periodId: string
  eventName: string
  eventIcon: string
  eventDate: string
  teams: Team[]
  myTeam: Team | null
  participantType: 'team' | 'individual'
}

export default function EventSignupForm({
  periodId, eventName, eventIcon, eventDate, teams, myTeam: initialMyTeam, participantType
}: Props) {
  const router = useRouter()
  const [myTeam, setMyTeam]           = useState(initialMyTeam)
  const [showCreate, setShowCreate]   = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')

  async function handleJoin(permanentTeamId: string) {
    setLoading(true)
    setError('')
    const res = await fetch('/api/join/team-direct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodId, teamId: permanentTeamId }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error ?? 'Could not join team'); return }
    router.refresh()
  }

  async function handleCreate() {
    if (!newTeamName.trim()) { setError('Enter a team name'); return }
    setLoading(true)
    setError('')
    const res = await fetch('/api/join/create-team-direct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodId, teamName: newTeamName.trim() }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error ?? 'Could not create team'); return }
    setNewTeamName('')
    setShowCreate(false)
    router.refresh()
  }

  async function handleLeave() {
    setLoading(true)
    setError('')
    const res = await fetch('/api/join/leave', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodId }),
    })
    setLoading(false)
    if (!res.ok) { setError('Could not remove sign-up'); return }
    setMyTeam(null)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="text-5xl mb-2">{eventIcon}</div>
        <h1 className="text-2xl font-bold text-[#242622]">{eventName}</h1>
        <p className="text-[#7E613F] mt-1">{eventDate}</p>
      </div>

      {/* My current sign-up */}
      {myTeam && (
        <div className="bg-[#87A67F]/15 border border-[#87A67F] rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#5a7a54] uppercase tracking-widest font-medium mb-1">You&apos;re signed up</p>
              <p className="text-lg font-bold text-[#242622]">{myTeam.name}</p>
              {myTeam.members.length > 0 && (
                <p className="text-sm text-[#7E613F] mt-0.5">{myTeam.members.join(', ')}</p>
              )}
            </div>
            <button
              onClick={handleLeave}
              disabled={loading}
              className="text-xs text-[#96321F] hover:text-[#ae3a24] font-medium disabled:opacity-40 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Team list */}
      {!myTeam && (
        <div className="space-y-3">
          <p className="text-xs text-[#7E613F] uppercase tracking-widest font-medium">
            {teams.length > 0 ? 'Join an existing team' : 'No teams yet — be the first!'}
          </p>

          {teams.map(team => (
            <div
              key={team.periodTeamId}
              className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-semibold text-[#242622]">{team.name}</p>
                <p className="text-sm text-[#7E613F] mt-0.5">
                  {team.memberCount === 0
                    ? 'No members yet'
                    : team.members.join(', ')}
                </p>
              </div>
              <button
                onClick={() => handleJoin(team.permanentTeamId)}
                disabled={loading}
                className="bg-[#96321F] text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-40 hover:bg-[#ae3a24] active:scale-[0.97] transition-all"
              >
                Join
              </button>
            </div>
          ))}

          {/* Create new team */}
          {!showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full border-2 border-dashed border-[#C8BCA4] rounded-2xl p-4 text-[#7E613F] font-medium hover:border-[#96321F] hover:text-[#96321F] transition-colors text-sm"
            >
              + Create a new team
            </button>
          ) : (
            <div className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-4 space-y-3">
              <p className="text-sm font-medium text-[#242622]">New team name</p>
              <input
                type="text"
                value={newTeamName}
                onChange={e => setNewTeamName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="Enter team name…"
                className="w-full border border-[#C8BCA4] rounded-xl px-3 py-2.5 text-[#242622] text-base focus:outline-none focus:border-[#96321F]"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={loading || !newTeamName.trim()}
                  className="flex-1 bg-[#96321F] text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-40 hover:bg-[#ae3a24] transition-colors"
                >
                  {loading ? 'Creating…' : 'Create & Join'}
                </button>
                <button
                  onClick={() => { setShowCreate(false); setNewTeamName('') }}
                  className="px-4 py-2.5 rounded-xl border border-[#D4CFC3] text-[#7E613F] text-sm hover:bg-[#F5F2EC] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 text-center">{error}</p>
      )}
    </div>
  )
}
