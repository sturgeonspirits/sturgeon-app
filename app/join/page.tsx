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
  eventDate: string | null       // 'YYYY-MM-DD'
  eventDateLabel: string | null  // 'Thursday, March 27 · 7:00 PM'
}

// ── Simple QR code via Google Charts API ─────────────────────────────────────
function QRCode({ url }: { url: string }) {
  const encoded = encodeURIComponent(url)
  return (
    <img
      src={`https://chart.googleapis.com/chart?cht=qr&chs=220x220&chl=${encoded}&choe=UTF-8`}
      alt="QR code"
      width={220}
      height={220}
      className="rounded-xl mx-auto"
    />
  )
}

function JoinPageInner() {
  const router   = useRouter()
  const params   = useSearchParams()
  const token    = params.get('t')
  const teamParam = params.get('team')   // ?team=ID → direct join shortcut
  const supabase = createClient()

  type View = 'loading' | 'error' | 'teams' | 'create' | 'joined' | 'created' | 'needsAuth'

  const [view,        setView]        = useState<View>('loading')
  const [period,      setPeriod]      = useState<PeriodInfo | null>(null)
  const [teams,       setTeams]       = useState<Team[]>([])
  const [user,        setUser]        = useState<any>(null)
  const [error,       setError]       = useState<string | null>(null)
  const [submitting,  setSubmitting]  = useState(false)

  // Create team form
  const [newName,     setNewName]     = useState('')

  // Success state
  const [joinedTeam,  setJoinedTeam]  = useState<string | null>(null)
  const [createdTeam, setCreatedTeam] = useState<string | null>(null)
  const [createdId,   setCreatedId]   = useState<string | null>(null)

  useEffect(() => {
    if (!token) { setError('Invalid QR code — no token found.'); setView('error'); return }

    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser()
      setUser(u)

      const res = await fetch(`/api/join/period?t=${token}`)
      if (!res.ok) {
        setError('This QR code is not valid or the event has ended.')
        setView('error')
        return
      }
      const data = await res.json()
      setPeriod(data.period)
      setTeams(data.teams ?? [])

      // Direct team join via ?team= param
      if (teamParam && u) {
        await doJoin(teamParam, data.teams)
        return
      }

      setView(u ? 'teams' : 'needsAuth')
    }
    load()
  }, [token])

  async function doJoin(teamId: string, teamList?: Team[]) {
    setSubmitting(true)
    const res = await fetch('/api/join/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, teamId }),
    })
    const json = await res.json()
    if (res.ok) {
      setJoinedTeam(json.teamName)
      setView('joined')
    } else {
      setError(json.error ?? 'Could not join team')
      // Stay on teams view with error
      setView('teams')
      setTeams(teamList ?? teams)
    }
    setSubmitting(false)
  }

  async function doCreate() {
    if (!newName.trim()) return
    setSubmitting(true)
    setError(null)
    const res = await fetch('/api/join/create-team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, teamName: newName.trim() }),
    })
    const json = await res.json()
    if (res.ok) {
      setCreatedTeam(json.teamName)
      setCreatedId(json.teamId)
      setView('created')
    } else {
      setError(json.error ?? 'Could not create team')
    }
    setSubmitting(false)
  }

  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://sturgeon-app.netlify.app'
  const eventJoinUrl = `${siteOrigin}/join?t=${token}`
  const teamJoinUrl  = createdId ? `${siteOrigin}/join?t=${token}&team=${createdId}` : null

  // ── Render states ─────────────────────────────────────────────────────────

  if (view === 'loading') return (
    <Shell><p className="text-[#7E613F] text-sm text-center">Loading…</p></Shell>
  )

  if (view === 'error') return (
    <Shell>
      <div className="text-center space-y-3">
        <p className="text-3xl">🦫</p>
        <p className="font-bold text-[#242622]">Something's off</p>
        <p className="text-sm text-[#7E613F]">{error}</p>
        <a href="/events" className="text-sm text-[#96321F] underline">View upcoming events</a>
      </div>
    </Shell>
  )

  if (view === 'needsAuth') return (
    <Shell>
      <div className="space-y-5 w-full max-w-sm text-center">
        <p className="text-4xl">{period?.eventTypeIcon ?? '🎉'}</p>
        <div>
          <h1 className="text-xl font-bold text-[#242622]">{period?.eventTypeName}</h1>
          {period?.eventDateLabel ? (
            <p className="text-sm font-semibold text-[#96321F] mt-1">{period.eventDateLabel}</p>
          ) : (
            <p className="text-sm text-[#7E613F] mt-1">{period?.label}</p>
          )}
        </div>
        <p className="text-sm text-[#7E613F]">Sign in to join or create a team and earn points.</p>
        <a
          href={`/auth/login?redirect=/join?t=${token}${teamParam ? `%26team=${teamParam}` : ''}`}
          className="block w-full bg-[#96321F] text-white font-semibold py-3.5 rounded-xl text-center hover:bg-[#ae3a24] transition-colors"
        >
          Sign in →
        </a>
      </div>
    </Shell>
  )

  if (view === 'joined') return (
    <Shell>
      <div className="text-center space-y-4 max-w-sm w-full">
        <p className="text-5xl">🎉</p>
        <h1 className="text-2xl font-bold text-[#242622]">You're in!</h1>
        <p className="text-[#7E613F]">
          You joined <strong>{joinedTeam}</strong> for {period?.eventTypeName}
          {period?.eventDateLabel ? <> on <strong>{period.eventDateLabel}</strong></> : null}.
        </p>
        <p className="text-sm text-[#9E8F7E]">Points will be awarded after the event.</p>
        <a href="/club" className="block w-full bg-[#96321F] text-white font-semibold py-3.5 rounded-xl text-center hover:bg-[#ae3a24] transition-colors">
          Go to my profile →
        </a>
      </div>
    </Shell>
  )

  if (view === 'created') return (
    <Shell>
      <div className="space-y-5 w-full max-w-sm text-center">
        <p className="text-5xl">🏆</p>
        <div>
          <h1 className="text-xl font-bold text-[#242622]">Team created!</h1>
          <p className="text-sm text-[#7E613F] mt-1">You're on <strong>{createdTeam}</strong></p>
          {period?.eventDateLabel && (
            <p className="text-xs font-semibold text-[#96321F] mt-0.5">{period.eventDateLabel}</p>
          )}
        </div>

        <div className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-4 space-y-3">
          <p className="text-xs font-semibold text-[#7E613F] uppercase tracking-wide">Share with teammates</p>
          {teamJoinUrl && <QRCode url={teamJoinUrl} />}
          <p className="text-xs text-[#9E8F7E] break-all">{teamJoinUrl}</p>
          <button
            onClick={() => teamJoinUrl && navigator.clipboard.writeText(teamJoinUrl)}
            className="w-full border border-[#D4CFC3] text-sm text-[#7E613F] font-medium py-2.5 rounded-xl hover:bg-[#F1F1E7] transition-colors"
          >
            Copy link
          </button>
        </div>

        <a href="/club" className="block w-full text-sm text-[#9E8F7E] hover:text-[#7E613F] transition-colors py-2">
          Go to my profile →
        </a>
      </div>
    </Shell>
  )

  // Default: teams view
  return (
    <Shell>
      <div className="w-full max-w-sm space-y-5">
        {/* Header */}
        <div className="text-center">
          <p className="text-4xl mb-2">{period?.eventTypeIcon ?? '🎉'}</p>
          <h1 className="text-xl font-bold text-[#242622]">{period?.eventTypeName}</h1>
          {period?.eventDateLabel ? (
            <p className="text-sm font-semibold text-[#96321F] mt-1">{period.eventDateLabel}</p>
          ) : (
            <p className="text-sm text-[#7E613F] mt-1">{period?.label}</p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Create new team */}
        {view === 'create' ? (
          <div className="bg-[#FFFFFF] border border-[#D4CFC3] rounded-2xl p-4 space-y-3">
            <p className="text-sm font-semibold text-[#242622]">Name your team</p>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doCreate()}
              placeholder="Team name…"
              autoFocus
              className="w-full border border-[#D4CFC3] rounded-xl px-3 py-2.5 text-sm text-[#242622] focus:outline-none focus:border-[#96321F] transition-colors"
            />
            <div className="flex gap-2">
              <button
                onClick={doCreate}
                disabled={submitting || !newName.trim()}
                className="flex-1 bg-[#96321F] text-white font-semibold py-2.5 rounded-xl disabled:opacity-40 hover:bg-[#ae3a24] transition-colors text-sm"
              >
                {submitting ? 'Creating…' : 'Create team'}
              </button>
              <button
                onClick={() => { setView('teams'); setError(null) }}
                className="px-4 py-2.5 rounded-xl border border-[#D4CFC3] text-sm text-[#7E613F] hover:bg-[#F1F1E7] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setView('create')}
            className="w-full bg-[#96321F] text-white font-semibold py-3 rounded-xl hover:bg-[#ae3a24] transition-colors text-sm"
          >
            + Create a new team
          </button>
        )}

        {/* Existing teams */}
        {teams.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#7E613F] uppercase tracking-wide">Or join an existing team</p>
            {teams.map(team => (
              <button
                key={team.id}
                onClick={() => doJoin(team.id)}
                disabled={submitting}
                className="w-full bg-[#FFFFFF] border border-[#D4CFC3] rounded-xl px-4 py-3 text-left hover:border-[#96321F] transition-all group disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-[#242622] group-hover:text-[#96321F] transition-colors text-sm">{team.name}</p>
                    <p className="text-xs text-[#9E8F7E] mt-0.5">
                      {team.memberCount} member{team.memberCount !== 1 ? 's' : ''}
                      {team.members.length > 0 && ` · ${team.members.slice(0, 2).join(', ')}${team.members.length > 2 ? '…' : ''}`}
                    </p>
                  </div>
                  <span className="text-[#96321F] text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">Join →</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F1F1E7] flex flex-col items-center justify-center px-6 py-12">
      {children}
    </div>
  )
}

export default function JoinPage() {
  return (
    <Suspense fallback={<Shell><p className="text-[#7E613F] text-sm">Loading…</p></Shell>}>
      <JoinPageInner />
    </Suspense>
  )
}
