'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Team {
  id: string
  name: string
  memberCount: number
  members: string[]
}

interface PeriodInfo {
  id: string
  label: string
  eventTypeName: string
  eventTypeIcon: string
}

function JoinPageInner() {
  const router      = useRouter()
  const params      = useSearchParams()
  const token       = params.get('t')
  const supabase    = createClient()

  const [loading,    setLoading]    = useState(true)
  const [joining,    setJoining]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [period,     setPeriod]     = useState<PeriodInfo | null>(null)
  const [teams,      setTeams]      = useState<Team[]>([])
  const [user,       setUser]       = useState<any>(null)
  const [joined,     setJoined]     = useState<string | null>(null)  // team name

  useEffect(() => {
    if (!token) { setError('Invalid QR code.'); setLoading(false); return }

    async function load() {
      // Check auth
      const { data: { user: u } } = await supabase.auth.getUser()

      // Fetch period by token
      const res = await fetch(`/api/join/period?t=${token}`)
      if (!res.ok) {
        setError('This QR code is not valid or the event has ended.')
        setLoading(false)
        return
      }
      const data = await res.json()
      setPeriod(data.period)
      setTeams(data.teams ?? [])
      setUser(u)
      setLoading(false)
    }
    load()
  }, [token])

  async function joinTeam(teamId: string, teamName: string) {
    if (!user) {
      // Save token to session storage, redirect to login
      sessionStorage.setItem('join_token', token!)
      router.push(`/auth/login?redirect=/join?t=${token}`)
      return
    }
    setJoining(true)
    const res = await fetch('/api/join/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, teamId }),
    })
    if (res.ok) {
      setJoined(teamName)
    } else {
      const json = await res.json()
      setError(json.error ?? 'Could not join team')
    }
    setJoining(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F1F1E7] flex items-center justify-center">
        <p className="text-[#7E613F] text-sm">Loading…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F1F1E7] flex flex-col items-center justify-center px-6">
        <div className="text-center space-y-3">
          <p className="text-3xl">🦫</p>
          <p className="font-bold text-[#242622]">Hmm, something's off</p>
          <p className="text-sm text-[#7E613F]">{error}</p>
          <a href="/events" className="text-sm text-[#96321F] underline">View upcoming events</a>
        </div>
      </div>
    )
  }

  if (joined) {
    return (
      <div className="min-h-screen bg-[#F1F1E7] flex flex-col items-center justify-center px-6">
        <div className="text-center space-y-4 max-w-sm">
          <p className="text-5xl">🎉</p>
          <h1 className="text-2xl font-bold text-[#242622]">You're on the team!</h1>
          <p className="text-[#7E613F]">You've joined <strong>{joined}</strong> for {period?.eventTypeName}.</p>
          <p className="text-sm text-[#9E8F7E]">Your points will be awarded after the event.</p>
          <a
            href="/club"
            className="block w-full bg-[#96321F] text-white font-semibold py-3.5 rounded-xl text-center hover:bg-[#ae3a24] transition-colors"
          >
            Go to my profile →
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F1F1E7] flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center">
          <p className="text-4xl mb-2">{period?.eventTypeIcon ?? '🎉'}</p>
          <h1 className="text-xl font-bold text-[#242622]">{period?.eventTypeName}</h1>
          <p className="text-sm text-[#7E613F] mt-1">{period?.label}</p>
        </div>

        {!user && (
          <div className="bg-[#96321F]/8 border border-[#96321F]/20 rounded-xl px-4 py-3 text-sm text-[#96321F]">
            Sign in first to join a team and earn points.
          </div>
        )}

        {/* Team list */}
        {teams.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#7E613F] uppercase tracking-wide">Choose your team</p>
            {teams.map(team => (
              <button
                key={team.id}
                onClick={() => joinTeam(team.id, team.name)}
                disabled={joining}
                className="w-full bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl px-4 py-3.5 text-left hover:border-[#96321F] transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-[#242622] group-hover:text-[#96321F] transition-colors">{team.name}</p>
                    <p className="text-xs text-[#9E8F7E] mt-0.5">
                      {team.memberCount} member{team.memberCount !== 1 ? 's' : ''}
                      {team.members.length > 0 && ` · ${team.members.slice(0, 2).join(', ')}${team.members.length > 2 ? '…' : ''}`}
                    </p>
                  </div>
                  <span className="text-[#96321F] text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity">Join →</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl px-4 py-6 text-center">
            <p className="text-sm text-[#7E613F]">No teams have been set up yet. Ask a staff member.</p>
          </div>
        )}

        {!user && (
          <a
            href={`/auth/login?redirect=/join?t=${token}`}
            className="block w-full bg-[#96321F] text-white font-semibold py-3.5 rounded-xl text-center hover:bg-[#ae3a24] transition-colors"
          >
            Sign in to join
          </a>
        )}
      </div>
    </div>
  )
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F1F1E7] flex items-center justify-center">
        <p className="text-[#7E613F] text-sm">Loading…</p>
      </div>
    }>
      <JoinPageInner />
    </Suspense>
  )
}
